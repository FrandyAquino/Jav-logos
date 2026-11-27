import {
  act,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react";
import { expect, it, vi } from "vitest";

const close = vi.hoisted(() => ({
  check: null as (() => boolean) | null,
  holdSave: false,
  saveStarted: false,
  failSave: false,
  generationStarted: false,
  releaseSave: () => {},
  releaseGeneration: () => {},
}));
vi.mock("../../src/infrastructure/desktop", async (original) => ({
  ...(await original<typeof import("../../src/infrastructure/desktop")>()),
  watchClose: async (check: () => boolean) => {
    close.check = check;
    return () => {};
  },
  exportFile: async () => true,
  saveWorkspace: async (_snapshot: unknown, expectedRevision: number) => {
    close.saveStarted = true;
    if (close.holdSave)
      await new Promise<void>((resolve) => {
        close.releaseSave = resolve;
      });
    if (close.failSave) throw new Error("Injected disk full");
    return expectedRevision + 1;
  },
  generate: async () => {
    close.generationStarted = true;
    await new Promise<void>((resolve) => {
      close.releaseGeneration = resolve;
    });
    return {
      provider: "test",
      images: [
        {
          seed: 42,
          pngBase64:
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nksAAAAASUVORK5CYII=",
        },
      ],
    };
  },
}));

it.skipIf(!process.env.JAVLOGOS_PERF_DIR)(
  "frontend close predicate blocks pending writes, generation and unexported recovery (not native event delivery)",
  async () => {
    localStorage.clear();
    const { useStudio } = await import("../../src/application/use-studio");
    const { result, unmount } = renderHook(() => useStudio());
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => {
      await result.current.createBrand("Quit diagnostic");
    });
    expect(close.check?.()).toBe(false);
    close.holdSave = true;
    close.saveStarted = false;
    let pending!: Promise<void>;
    const { TextField } =
      await import("../../src/presentation/property-fields");
    const field = render(
      <TextField
        label="Quit draft"
        value="Quit diagnostic"
        maxLength={120}
        onCommit={(value) => {
          pending = result.current.updateBrandName(value);
        }}
      />,
    );
    const input = field.getByRole("textbox");
    act(() => input.focus());
    fireEvent.change(input, { target: { value: "Pending edit" } });
    expect(close.saveStarted).toBe(false);
    // The real close predicate blurs the active TextField and synchronously
    // enqueues its draft before deciding whether the window may close.
    act(() => {
      expect(close.check?.()).toBe(true);
    });
    await waitFor(() => expect(close.saveStarted).toBe(true));
    expect(close.check?.()).toBe(true);
    await act(async () => {
      close.releaseSave();
      await pending;
    });
    close.holdSave = false;
    expect(result.current.selectedBrand?.name).toBe("Pending edit");
    field.unmount();
    expect(close.check?.()).toBe(false);
    close.failSave = true;
    let generation!: ReturnType<typeof result.current.generate>;
    act(() => {
      generation = result.current.generate("local", 1);
    });
    await waitFor(() => expect(result.current.busy).toBe(true));
    expect(close.check?.()).toBe(true);
    await waitFor(() => expect(close.generationStarted).toBe(true));
    await act(async () => {
      close.releaseGeneration();
      await generation;
    });
    expect(result.current.pendingConcepts).toHaveLength(1);
    expect(result.current.busy).toBe(false);
    expect(close.check?.()).toBe(true);
    await act(async () => {
      await result.current.exportPendingBatch();
    });
    expect(result.current.pendingConcepts).toHaveLength(1);
    expect(close.check?.()).toBe(false);
    unmount();
  },
);
