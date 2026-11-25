// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { VectorDocument } from "../domain/types";
import { generateConcepts } from "../domain/vector";
import { DEFAULT_DNA } from "../domain/brand-dna";
const disk = vi.hoisted(() => ({ fail: false, writes: 0 }));
vi.mock("../infrastructure/text-fitting", () => ({
  fitDocumentText: async (doc: VectorDocument) => ({
    ...doc,
    wordmarkFit: 1,
    sloganFit: 1,
  }),
}));
vi.mock("../infrastructure/desktop", async (originalImport) => {
  const original =
    await originalImport<typeof import("../infrastructure/desktop")>();
  return {
    ...original,
    saveWorkspace: async (
      ...args: Parameters<typeof original.saveWorkspace>
    ) => {
      disk.writes++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      if (disk.fail) throw new Error("Storage unavailable");
      return original.saveWorkspace(...args);
    },
  };
});
import { useStudio } from "./use-studio";
it("keeps original/version data on failure and saves one derivative without changing a newer selection", async () => {
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nksAAAAASUVORK5CYII=";
  const concepts = generateConcepts(
    "brand",
    "Brand",
    "mark",
    DEFAULT_DNA,
    2,
    42,
  );
  concepts[0].raster = png;
  concepts[0].document.symbolSource = "image";
  concepts[0].versions.push({
    id: "version",
    createdAt: "now",
    document: structuredClone(concepts[0].document),
  });
  const workspace = {
    schemaVersion: 1,
    revision: 0,
    brands: [
      { id: "brand", name: "Brand", parentId: null, dna: {}, createdAt: "now" },
    ],
    concepts,
  };
  localStorage.clear();
  localStorage.setItem(
    "javlogos.workspace.v1",
    JSON.stringify({ snapshot: workspace, revision: 0 }),
  );
  const { result } = renderHook(() => useStudio());
  await waitFor(() => expect(result.current.ready).toBe(true));
  disk.fail = true;
  await act(async () => {
    expect(await result.current.saveCutout(concepts[0].id, png)).toBe(false);
  });
  expect(result.current.workspace).toEqual(workspace);
  disk.fail = false;
  disk.writes = 0;
  await act(async () => {
    const first = result.current.saveCutout(concepts[0].id, png);
    const duplicate = result.current.saveCutout(concepts[0].id, png);
    result.current.selectConcept(concepts[1].id);
    expect(await Promise.all([first, duplicate])).toEqual([true, false]);
  });
  expect(disk.writes).toBe(1);
  expect(result.current.selectedConcept?.id).toBe(concepts[1].id);
  expect(result.current.workspace.concepts.slice(0, 2)).toEqual(concepts);
  const derived = result.current.workspace.concepts[2];
  expect(derived.derivedFrom).toBe(concepts[0].id);
  expect(derived.raster).toBe(png);
  expect(derived.cutout).toBe(png);
  expect(derived.document.useCutout).toBe(true);
  expect(derived.versions).toEqual([]);
});
