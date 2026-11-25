// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
vi.mock("../infrastructure/desktop", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../infrastructure/desktop")>();
  return {
    ...original,
    saveWorkspace: async (
      ...args: Parameters<typeof original.saveWorkspace>
    ) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return original.saveWorkspace(...args);
    },
    generate: async () => {
      throw new Error("Model unavailable");
    },
  };
});
import { useStudio } from "./use-studio";
it("preserves prompt provenance and new drafts; restores complete versions and serializes history", async () => {
  localStorage.clear();
  const { result } = renderHook(() => useStudio());
  await waitFor(() => expect(result.current.ready).toBe(true));
  await act(async () => {
    result.current.setPrompt("Preserve on preflight failure");
    await result.current.generate("procedural", 1);
  });
  expect(result.current.prompt).toBe("Preserve on preflight failure");
  await act(async () => {
    await result.current.createBrand("Expansion QA");
    result.current.setPrompt("First submitted mark");
    const saving = result.current.updateDna({ geometry: "petal" });
    const generating = result.current.generate("procedural", 1);
    result.current.setPrompt("A newer draft");
    await Promise.all([saving, generating]);
  });
  expect(result.current.prompt).toBe("A newer draft");
  expect(result.current.submittedPrompt).toBe("First submitted mark");
  expect(result.current.selectedConcept?.prompt).toBe("First submitted mark");
  await act(async () => {
    await result.current.generate("procedural", 1);
  });
  expect(result.current.prompt).toBe("");
  expect(result.current.selectedConcept?.prompt).toBe("A newer draft");
  await act(async () => {
    result.current.setPrompt("Failed local request");
    await result.current.generate("local", 1);
  });
  expect(result.current.prompt).toBe("");
  expect(result.current.error).toBe("Model unavailable");
  act(() => result.current.reuseSubmittedPrompt());
  expect(result.current.prompt).toBe("Failed local request");
  const original = structuredClone(result.current.selectedConcept!.document);
  await act(async () => {
    await result.current.saveVersion();
  });
  const version = result.current.selectedConcept!.versions.at(-1)!;
  await act(async () => {
    await result.current.updateConcept({
      layout: "horizontal",
      slogan: "New slogan",
    });
    await result.current.restoreVersion(version.id);
  });
  expect(result.current.selectedConcept!.document).toEqual(original);
  await act(async () => {
    await result.current.updateConcept({ text: "One" });
    await result.current.updateConcept({ text: "Two" });
    await Promise.all([
      result.current.undoConcept(),
      result.current.undoConcept(),
    ]);
  });
  expect(result.current.selectedConcept!.document).toEqual(original);
  await act(async () => {
    await Promise.all([
      result.current.redoConcept(),
      result.current.redoConcept(),
    ]);
  });
  expect(result.current.selectedConcept!.document.text).toBe("Two");
});
