// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type {
  Concept,
  GenerationRequest,
  GenerationResult,
} from "../domain/types";
import { generateConcepts } from "../domain/vector";
import { DEFAULT_DNA } from "../domain/brand-dna";
import {
  applyCompositionChanges,
  type CompositionChanges,
} from "../domain/refinement";
const fixture = vi.hoisted(() => ({
  png: "data:image/png;base64,aGVsbG8=",
  fail: false,
  calls: [] as GenerationRequest[],
  resolve: null as null | ((value: GenerationResult) => void),
}));
vi.mock("../infrastructure/refinement-preview", () => ({
  snapshotComposition: vi.fn(async () => fixture.png),
  prepareSymbolReference: vi.fn(async () => fixture.png),
  previewCompositionRefinement: async (
    source: Concept,
    changes: CompositionChanges,
  ) => ({ ...source, document: applyCompositionChanges(source, changes) }),
}));
vi.mock("../infrastructure/desktop", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../infrastructure/desktop")>();
  return {
    ...original,
    saveWorkspace: async (
      ...args: Parameters<typeof original.saveWorkspace>
    ) => {
      await new Promise((resolve) => setTimeout(resolve, 15));
      if (fixture.fail) throw new Error("Disk full");
      return original.saveWorkspace(...args);
    },
    generate: (request: GenerationRequest) => {
      fixture.calls.push(request);
      return new Promise<GenerationResult>((resolve) => {
        fixture.resolve = resolve;
      });
    },
    cancel: async () => true,
  };
});
import { useStudio } from "./use-studio";
it("preserves source, handles selection races, retains AI recovery metadata and discards late cancelled results", async () => {
  const concepts = generateConcepts(
    "brand",
    "Source",
    "initial",
    DEFAULT_DNA,
    2,
    42,
  );
  concepts[0].document.slogan = "Keep this slogan";
  localStorage.clear();
  localStorage.setItem(
    "javlogos.workspace.v1",
    JSON.stringify({
      revision: 0,
      snapshot: {
        schemaVersion: 1,
        revision: 0,
        brands: [
          {
            id: "brand",
            name: "Brand",
            parentId: null,
            dna: {},
            createdAt: "now",
          },
        ],
        concepts,
      },
    }),
  );
  const { result } = renderHook(() => useStudio());
  await waitFor(() => expect(result.current.ready).toBe(true));
  fixture.fail = true;
  await act(async () => {
    expect(
      await result.current.refineComposition(concepts[0].id, {
        fontFamily: "Manrope",
      }),
    ).toBe(false);
  });
  expect(result.current.workspace.concepts).toEqual(concepts);
  fixture.fail = false;
  await act(async () => {
    const saving = result.current.refineComposition(concepts[0].id, {
      fontFamily: "Manrope",
    });
    const duplicate = result.current.refineComposition(concepts[0].id, {
      fontFamily: "Manrope",
    });
    result.current.selectConcept(concepts[1].id);
    expect(await Promise.all([saving, duplicate])).toEqual([true, false]);
  });
  expect(result.current.selectedConcept?.id).toBe(concepts[1].id);
  const exact = result.current.workspace.concepts[2];
  expect(exact.derivedFrom).toBe(concepts[0].id);
  expect(exact.refinement?.kind).toBe("composition");
  expect(exact.document.fontFamily).toBe("Manrope");
  let generating: Promise<boolean>;
  act(() => {
    result.current.setPrompt("Keep my composer draft");
    generating = result.current.refineWithAi(
      concepts[0].id,
      "Simplify the symbol",
      1,
    );
  });
  await waitFor(() => expect(fixture.calls).toHaveLength(1));
  expect(fixture.calls[0].referenceBase64).toBe(fixture.png.split(",")[1]);
  expect(fixture.calls[0].prompt).toContain("Simplify the symbol");
  fixture.fail = true;
  await act(async () => {
    fixture.resolve!({
      provider: "Mock local",
      images: [{ pngBase64: "aGVsbG8=", seed: 15 }],
    });
    expect(await generating).toBe(false);
  });
  expect(result.current.prompt).toBe("Keep my composer draft");
  expect(result.current.pendingConcepts).toHaveLength(1);
  const pending = result.current.pendingConcepts[0];
  expect(pending.refinement?.before).toBe(fixture.png);
  expect(pending.document.slogan).toBe("Keep this slogan");
  expect(pending.document.text).toBe("Source");
  expect(pending.document.symbolSource).toBe("image");
  fixture.fail = false;
  await act(async () => {
    await result.current.retryPendingSave();
  });
  expect(fixture.calls).toHaveLength(1);
  expect(result.current.selectedConcept?.id).toBe(concepts[1].id);
  expect(
    result.current.workspace.concepts.find((c) => c.id === pending.id)
      ?.refinement?.instruction,
  ).toBe("Simplify the symbol");
  const savedCount = result.current.workspace.concepts.length;
  act(() => {
    generating = result.current.refineWithAi(
      concepts[0].id,
      "More geometric",
      1,
    );
  });
  await waitFor(() => expect(fixture.calls).toHaveLength(2));
  await act(async () => {
    await result.current.cancelGeneration();
    fixture.resolve!({
      provider: "Mock local",
      images: [{ pngBase64: "aGVsbG8=", seed: 18 }],
    });
    expect(await generating).toBe(false);
  });
  expect(result.current.workspace.concepts).toHaveLength(savedCount);
  expect(result.current.workspace.concepts[0]).toEqual(concepts[0]);
  expect(result.current.generationProgress?.phase).toBe("cancelled");
});
