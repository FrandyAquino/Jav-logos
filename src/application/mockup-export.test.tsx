// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import type { Concept, Brand } from "../domain/types";
import { expect, it, vi } from "vitest";
const disk = vi.hoisted(() => ({ fail: false, exports: 0 }));
vi.mock("../infrastructure/desktop", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../infrastructure/desktop")>();
  return {
    ...original,
    saveWorkspace: async (
      ...args: Parameters<typeof original.saveWorkspace>
    ) => {
      await new Promise((resolve) => setTimeout(resolve, 15));
      if (disk.fail) throw new Error("Disk full");
      return original.saveWorkspace(...args);
    },
    exportFile: async () => {
      disk.exports++;
      return true;
    },
  };
});
import { useStudio } from "./use-studio";
it("captures the latest saved artwork and never exports after a failed prerequisite save", async () => {
  localStorage.clear();
  const { result } = renderHook(() => useStudio());
  await waitFor(() => expect(result.current.ready).toBe(true));
  await act(async () => {
    await result.current.createBrand("Mockup QA");
    await result.current.generate("procedural", 1);
  });
  const id = result.current.selectedConcept!.id;
  const capture = vi.fn(async (concept: Concept, brand: Brand) => {
    expect(concept.brandId).toBe(brand.id);
    return new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  });
  await act(async () => {
    await Promise.all([
      result.current.updateConcept({ text: "Latest wordmark" }),
      result.current.exportMockup(id, "card", capture),
    ]);
  });
  expect(capture.mock.calls).toHaveLength(1);
  expect(capture.mock.calls[0][0].document.text).toBe("Latest wordmark");
  expect(disk.exports).toBe(1);
  disk.fail = true;
  await act(async () => {
    await Promise.all([
      result.current.updateConcept({ text: "Unsaved wordmark" }),
      result.current.exportMockup(id, "card", capture),
    ]);
  });
  expect(capture.mock.calls).toHaveLength(1);
  expect(disk.exports).toBe(1);
  expect(result.current.error).toBe("Disk full");
  expect(result.current.busy).toBe(false);
});
