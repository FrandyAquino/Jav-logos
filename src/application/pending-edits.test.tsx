// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
const exported = vi.hoisted(() => ({ svg: "", failSave: false }));
vi.mock("../infrastructure/desktop", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../infrastructure/desktop")>();
  return {
    ...original,
    saveWorkspace: async (
      ...args: Parameters<typeof original.saveWorkspace>
    ) => {
      await new Promise((resolve) => setTimeout(resolve, 25));
      if (exported.failSave) throw new Error("Disk full");
      return original.saveWorkspace(...args);
    },
    exportFile: async (_name: string, bytes: Uint8Array) => {
      exported.svg = new TextDecoder().decode(bytes);
      return true;
    },
  };
});
import { useStudio } from "./use-studio";
it("exports and generates from the latest queued edit rather than the last completed save", async () => {
  localStorage.clear();
  const { result } = renderHook(() => useStudio());
  await waitFor(() => expect(result.current.ready).toBe(true));
  await act(async () => {
    await result.current.createBrand("Original");
    await result.current.generate("procedural", 1);
  });
  await act(async () => {
    await Promise.all([
      result.current.updateConcept({ text: "Edited" }),
      result.current.exportSvg("composition"),
    ]);
  });
  expect(exported.svg).toContain(">Edited</text>");
  await act(async () => {
    await Promise.all([
      result.current.updateDna({ geometry: "petal" }),
      result.current.generate("procedural", 1),
    ]);
  });
  expect(result.current.selectedConcept?.document.shape).toBe("petal");
  exported.svg = "";
  exported.failSave = true;
  await act(async () => {
    await Promise.all([
      result.current.updateConcept({ text: "Unsaved" }),
      result.current.exportSvg("composition"),
    ]);
  });
  expect(exported.svg).toBe("");
  expect(result.current.error).toBe("Disk full");
});
