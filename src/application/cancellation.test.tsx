// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { GenerationResult } from "../domain/types";
let resolveGeneration: (result: GenerationResult) => void;
let resolveCancellation: (result: boolean) => void;
vi.mock("../infrastructure/desktop", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../infrastructure/desktop")>()),
  generate: () =>
    new Promise<GenerationResult>((resolve) => {
      resolveGeneration = resolve;
    }),
  cancel: () =>
    new Promise<boolean>((resolve) => {
      resolveCancellation = resolve;
    }),
}));
import { useStudio } from "./use-studio";
it("discards a late image when cancellation is requested before the worker acknowledges it", async () => {
  localStorage.clear();
  const { result } = renderHook(() => useStudio());
  await waitFor(() => expect(result.current.ready).toBe(true));
  await act(async () => {
    await result.current.createBrand("Cancel test");
  });
  let generating: Promise<void>;
  let cancelling: Promise<void>;
  act(() => {
    generating = result.current.generate("local", 1);
  });
  await waitFor(() => expect(resolveGeneration).toBeTypeOf("function"));
  act(() => {
    cancelling = result.current.cancelGeneration();
  });
  await act(async () => {
    resolveGeneration({
      provider: "test",
      images: [{ pngBase64: "unused", seed: 1 }],
    });
    await generating;
  });
  expect(result.current.workspace.concepts).toHaveLength(0);
  await act(async () => {
    resolveCancellation(true);
    await cancelling;
  });
  expect(result.current.busy).toBe(false);
});
