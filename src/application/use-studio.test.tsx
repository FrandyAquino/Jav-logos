// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import { useStudio } from "./use-studio";
it("persists a brand family, serializes edits, preserves versions and rejects a stale writer", async () => {
  localStorage.clear();
  const { result } = renderHook(() => useStudio());
  await waitFor(() => expect(result.current.ready).toBe(true));
  await act(async () => {
    await result.current.createBrand("JavCollections");
  });
  const parentId = result.current.selectedBrand!.id;
  await act(async () => {
    await result.current.updateDna({ typography: "Georgia" });
    await result.current.createBrand("JavLogos", parentId);
  });
  expect(result.current.resolvedDna.typography).toBe("Georgia");
  await act(async () => {
    await result.current.generate("procedural", 4);
  });
  expect(result.current.workspace.concepts).toHaveLength(4);
  await act(async () => {
    await result.current.saveVersion();
  });
  const version = result.current.selectedConcept!.versions[0];
  await act(async () => {
    await Promise.all([
      result.current.updateConcept({ rotation: 30 }),
      result.current.updateConcept({ scale: 1.2 }),
    ]);
  });
  expect(result.current.selectedConcept!.document).toMatchObject({
    rotation: 30,
    scale: 1.2,
  });
  await act(async () => {
    await result.current.restoreVersion(version.id);
  });
  expect(result.current.selectedConcept!.document).toEqual(version.document);
  const stored = JSON.parse(localStorage.getItem("javlogos.workspace.v1")!);
  expect(stored.snapshot.brands).toHaveLength(2);
  expect(stored.snapshot.concepts[0].versions).toHaveLength(1);
  localStorage.setItem(
    "javlogos.workspace.v1",
    JSON.stringify({ ...stored, revision: stored.revision + 1 }),
  );
  await act(async () => {
    await result.current.updateConcept({ rotation: 90 });
  });
  expect(result.current.error).toMatch(/another window/);
  expect(result.current.selectedConcept!.document.rotation).toBe(
    version.document.rotation,
  );
});
