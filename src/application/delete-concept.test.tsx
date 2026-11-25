// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
const storage = vi.hoisted(() => ({ fail: false, writes: 0 }));
vi.mock("../infrastructure/desktop", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../infrastructure/desktop")>();
  return {
    ...original,
    saveWorkspace: async (
      ...args: Parameters<typeof original.saveWorkspace>
    ) => {
      storage.writes++;
      await new Promise((resolve) => setTimeout(resolve, 15));
      if (storage.fail) throw new Error("Disk full");
      return original.saveWorkspace(...args);
    },
  };
});
import { useStudio } from "./use-studio";
it("deletes only the captured concept after saving, preserves selection on failure and prevents duplicate writes", async () => {
  localStorage.clear();
  const { result } = renderHook(() => useStudio());
  await waitFor(() => expect(result.current.ready).toBe(true));
  await act(async () => {
    await result.current.createBrand("First brand");
    await result.current.generate("procedural", 3);
    await result.current.saveVersion();
    await result.current.updateConcept({ text: "With history" });
  });
  const [first, second, third] = result.current.workspace.concepts;
  const before = structuredClone(result.current.workspace);
  storage.fail = true;
  await act(async () => {
    expect(await result.current.deleteConcept(first.id)).toBe(false);
  });
  expect(result.current.workspace).toEqual(before);
  expect(result.current.selectedConcept?.id).toBe(first.id);
  expect(result.current.canUndo).toBe(true);
  storage.fail = false;
  storage.writes = 0;
  await act(async () => {
    expect(
      await Promise.all([
        result.current.deleteConcept(first.id),
        result.current.deleteConcept(first.id),
      ]),
    ).toEqual([true, false]);
  });
  expect(storage.writes).toBe(1);
  expect(result.current.workspace.concepts.map((c) => c.id)).toEqual([
    second.id,
    third.id,
  ]);
  expect(result.current.selectedConcept?.id).toBe(second.id);
  expect(result.current.canUndo).toBe(false);
  await act(async () => {
    const pending = result.current.deleteConcept(second.id);
    result.current.selectConcept(third.id);
    await pending;
  });
  expect(result.current.selectedConcept?.id).toBe(third.id);
  await act(async () => {
    await result.current.createBrand("Other brand");
    result.current.setPrompt("Different direction");
    await result.current.generate("procedural", 1);
  });
  const other = result.current.selectedConcept!;
  await act(async () => {
    await result.current.deleteConcept(third.id);
  });
  expect(result.current.selectedConcept?.id).toBe(other.id);
  expect(result.current.workspace.concepts).toHaveLength(1);
  await act(async () => {
    await result.current.deleteConcept(other.id);
  });
  expect(result.current.selectedConcept).toBeUndefined();
  expect(result.current.workspace.brands).toHaveLength(2);
  expect(
    JSON.parse(localStorage.getItem("javlogos.workspace.v1")!).snapshot
      .concepts,
  ).toEqual([]);
});
