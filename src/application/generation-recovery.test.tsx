// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
const storage = vi.hoisted(() => ({ fail: false }));
vi.mock("../infrastructure/desktop", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../infrastructure/desktop")>();
  return {
    ...original,
    generate: async (request: { count: number }) => ({
      provider: "Test boundary",
      images: Array.from({ length: request.count }, (_, seed) => ({
        seed,
        pngBase64:
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nksAAAAASUVORK5CYII=",
      })),
    }),
    saveWorkspace: async (
      ...args: Parameters<typeof original.saveWorkspace>
    ) => {
      if (storage.fail) throw new Error("Disk full");
      return original.saveWorkspace(...args);
    },
  };
});
import { useStudio } from "./use-studio";
it("retains completed generation on a failed save and retries without generating again", async () => {
  localStorage.clear();
  const { result } = renderHook(() => useStudio());
  await waitFor(() => expect(result.current.ready).toBe(true));
  await act(async () => {
    await result.current.createBrand("Recovery");
  });
  storage.fail = true;
  await act(async () => {
    await result.current.generate("local", 2);
  });
  expect(result.current.workspace.concepts).toHaveLength(0);
  expect(result.current.pendingConcepts).toHaveLength(2);
  const closing = new Event("beforeunload", { cancelable: true });
  act(() => {
    window.dispatchEvent(closing);
  });
  expect(closing.defaultPrevented).toBe(true);
  const ids = result.current.pendingConcepts.map((c) => c.id);
  storage.fail = false;
  await act(async () => {
    await result.current.retryPendingSave();
  });
  expect(result.current.workspace.concepts.map((c) => c.id)).toEqual(ids);
  expect(result.current.pendingConcepts).toHaveLength(0);
  expect(result.current.generationProgress?.phase).toBe("completed");
  const safeClose = new Event("beforeunload", { cancelable: true });
  act(() => {
    window.dispatchEvent(safeClose);
  });
  expect(safeClose.defaultPrevented).toBe(false);
  const dna = structuredClone(
    result.current.workspace.concepts[0].generationContext!.dna,
  );
  await act(async () => {
    await result.current.updateDna({ tone: "Different" });
  });
  expect(result.current.workspace.concepts[0].generationContext!.dna).toEqual(
    dna,
  );
});
