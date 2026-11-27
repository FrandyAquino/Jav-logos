import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Profiler, createElement } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { Workspace } from "../../src/domain/types";
import type { useStudio as StudioHook } from "../../src/application/use-studio";
import { workspaceSchema } from "../../src/domain/schema";

const boundary = vi.hoisted(() => ({
  snapshot: null as Workspace | null,
  artworkRenders: 0,
  ipcBytes: 0,
}));
vi.mock("../../src/infrastructure/desktop", async (original) => ({
  ...(await original<typeof import("../../src/infrastructure/desktop")>()),
  loadWorkspace: async () => ({ snapshot: boundary.snapshot, revision: 0 }),
  // Real validation and IPC-argument serialization, deliberately no localStorage
  // (jsdom's 5MB quota) or pretend native transport/disk timings.
  saveWorkspace: async (snapshot: Workspace, expectedRevision: number) => {
    workspaceSchema.parse(snapshot);
    boundary.ipcBytes = Buffer.byteLength(
      JSON.stringify({ snapshot, expectedRevision }),
    );
    return expectedRevision + 1;
  },
}));
vi.mock("../../src/presentation/concept-artwork", async (original) => {
  const actual =
    await original<typeof import("../../src/presentation/concept-artwork")>();
  return {
    ...actual,
    ConceptArtwork: (props: Parameters<typeof actual.ConceptArtwork>[0]) => {
      boundary.artworkRenders++;
      return createElement(actual.ConceptArtwork, props);
    },
  };
});
const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const measure = (run: () => unknown) => {
  const start = performance.now();
  run();
  return performance.now() - start;
};

for (const count of [100, 500, 2000]) {
  it.skipIf(!process.env.JAVLOGOS_PERF_DIR)(
    `workspace performance ${count}`,
    async () => {
      const source = readFileSync(
        join(process.env.JAVLOGOS_PERF_DIR!, `workspace-${count}.json`),
        "utf8",
      );
      const snapshot = JSON.parse(source) as Workspace;
      const parse: number[] = [],
        stringify: number[] = [],
        clone: number[] = [],
        validate: number[] = [];
      const heapBefore = process.memoryUsage();
      for (let run = 0; run < 5; run++) {
        parse.push(measure(() => JSON.parse(source)));
        stringify.push(
          measure(() => JSON.stringify({ snapshot, expectedRevision: 0 })),
        );
        clone.push(measure(() => structuredClone(snapshot)));
        validate.push(measure(() => workspaceSchema.parse(snapshot)));
      }
      const heapAfter = process.memoryUsage();
      boundary.snapshot = snapshot;
      vi.resetModules();
      const { useStudio } = await import("../../src/application/use-studio");
      const { result, unmount } = renderHook(() => useStudio());
      await waitFor(() => expect(result.current.ready).toBe(true));
      const saveOne: number[] = [],
        saveVersion: number[] = [],
        remove: number[] = [];
      for (let run = 0; run < 5; run++) {
        let start = performance.now();
        await act(async () => {
          await result.current.updateConceptMetadata("concept-0", {
            name: `Edited ${run}`,
          });
        });
        saveOne.push(performance.now() - start);
        start = performance.now();
        await act(async () => {
          await result.current.saveVersion();
        });
        saveVersion.push(performance.now() - start);
      }
      const ipcBytes = boundary.ipcBytes;
      const { CreativeCanvas } =
        await import("../../src/presentation/creative-canvas");
      const { BrandSidebar } =
        await import("../../src/presentation/brand-sidebar");
      let commits: number[] = [];
      const commit = (_id: string, _phase: string, duration: number) => {
        commits.push(duration);
      };
      // Concentrated-brand stress scenario: same assets/count, every concept visible.
      const concentrated = {
        ...result.current.workspace,
        concepts: result.current.workspace.concepts.map((c) => ({
          ...c,
          brandId: "brand-0",
        })),
      };
      let current!: ReturnType<typeof StudioHook>;
      function GalleryHarness() {
        current = useStudio();
        const studio = { ...current, workspace: concentrated };
        return (
          <Profiler id="workspace" onRender={commit}>
            <BrandSidebar studio={studio} onCreate={() => {}} />
            <CreativeCanvas studio={studio} onCreate={() => {}} />
          </Profiler>
        );
      }
      const view = render(<GalleryHarness />);
      fireEvent.click(view.getByRole("button", { name: "Gallery view" }));
      expect(view.container.querySelectorAll(".gallery-card")).toHaveLength(
        count,
      );
      const updateWall: number[] = [],
        renderDuration: number[] = [],
        artworkCounts: number[] = [];
      for (let run = 0; run < 5; run++) {
        boundary.artworkRenders = 0;
        commits = [];
        const start = performance.now();
        act(() => {
          current.setPrompt(`Prompt ${run}`);
        });
        updateWall.push(performance.now() - start);
        renderDuration.push(commits.reduce((sum, value) => sum + value, 0));
        artworkCounts.push(boundary.artworkRenders);
      }
      view.unmount();
      for (let run = 0; run < 5; run++) {
        const start = performance.now();
        await act(async () => {
          expect(
            await result.current.deleteConcept(`concept-${count - 1 - run}`),
          ).toBe(true);
        });
        remove.push(performance.now() - start);
      }
      expect(result.current.workspace.concepts).toHaveLength(count - 5);
      unmount();
      cleanup();
      // Vitest's agent reporter may suppress console output. The parent runner
      // publishes these results after the test process exits successfully.
      writeFileSync(
        join(process.env.JAVLOGOS_PERF_DIR!, `frontend-${count}.json`),
        JSON.stringify({
          concepts: count,
          brands: snapshot.brands.length,
          runs: 5,
          ipcBytes,
          medianMs: {
            jsonParse: median(parse),
            stringify: median(stringify),
            structuredClone: median(clone),
            schema: median(validate),
            storeSaveOne: median(saveOne),
            storeSaveVersion: median(saveVersion),
            storeDelete: median(remove),
            galleryPromptWall: median(updateWall),
            galleryProfiler: median(renderDuration),
          },
          artworkRendersPerPrompt: artworkCounts,
          samplesMs: {
            parse,
            stringify,
            clone,
            validate,
            saveOne,
            saveVersion,
            remove,
            updateWall,
            renderDuration,
          },
          memoryObservation: {
            heapBefore: heapBefore.heapUsed,
            heapAfter: heapAfter.heapUsed,
            rssBefore: heapBefore.rss,
            rssAfter: heapAfter.rss,
          },
        }),
      );
    },
  );
}
