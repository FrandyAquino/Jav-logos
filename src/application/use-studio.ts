import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { DEFAULT_DNA, buildPrompt, resolveDna } from "../domain/brand-dna";
import { generateConcepts } from "../domain/vector";
import {
  dnaSchema,
  documentSchema,
  workspaceSchema,
  brandMetadataSchema,
  bookSchema,
} from "../domain/schema";
import { reorderPinned } from "../domain/brand-library";
import { startGenerationMonitor } from "./generation-monitor";
import type {
  BrandDna,
  Brand,
  GenerationProgress,
  Concept,
  ProviderHealth,
  VectorDocument,
  Workspace,
} from "../domain/types";
import * as desktop from "../infrastructure/desktop";
import { buildKit, rasterize } from "../infrastructure/export";
import { sanitizeSvg } from "../infrastructure/svg";
import { prepareCompositionSvg } from "../infrastructure/font-export";
import { embedFont } from "../infrastructure/font-export";
import { compositionAsset } from "../infrastructure/composition";
import { renderMotionSvg } from "../domain/vector";
import { createStarterPaths } from "../domain/vector-paths";
import { importTracePaths } from "../infrastructure/trace-import";
import { buildBrandBook } from "../infrastructure/brand-book";

interface StudioState {
  workspace: Workspace;
  selectedBrandId: string | null;
  selectedConceptId: string | null;
  prompt: string;
  submittedPrompt: string | null;
  generationTarget: "symbol" | "full-logo";
  historyRevision: number;
  status: string;
  error: string | null;
  busy: boolean;
  ready: boolean;
  cancellable: boolean;
  providerHealth: ProviderHealth;
  theme: "light" | "dark";
  referenceUrl: string | null;
  referenceInfo: {
    name: string;
    width: number;
    height: number;
    size: number;
  } | null;
  referenceLoading: boolean;
  generationProgress: GenerationProgress | null;
  generationStartedAt: number | null;
  generationBrandId: string | null;
  generationBrandName: string | null;
  pendingConcepts: Concept[];
  pendingRecoveryExported: boolean;
}
const useState = create<StudioState>(() => ({
  workspace: { schemaVersion: 1, revision: 0, brands: [], concepts: [] },
  selectedBrandId: null,
  selectedConceptId: null,
  prompt: "A distinctive geometric mark with a confident, timeless silhouette",
  submittedPrompt: null,
  generationTarget: "symbol",
  historyRevision: 0,
  status: "Opening workspace…",
  error: null,
  busy: false,
  ready: false,
  cancellable: false,
  providerHealth: {
    available: false,
    provider: "Checking local runtime",
    message: "",
  },
  theme: localStorage.getItem("javlogos.theme") === "light" ? "light" : "dark",
  referenceUrl: null,
  referenceInfo: null,
  referenceLoading: false,
  generationProgress: null,
  generationStartedAt: null,
  generationBrandId: null,
  generationBrandName: null,
  pendingConcepts: [],
  pendingRecoveryExported: false,
}));
const get = useState.getState,
  set = useState.setState;
let initialization: Promise<void> | undefined;
let writeQueue: Promise<void> = Promise.resolve();
let writeError: unknown = null;
let pendingWrites = 0;
let referenceSequence = 0;
let activeJob: string | null = null;
const deletingConcepts = new Set<string>();
const documentHistory = new Map<
  string,
  { undo: VectorDocument[]; redo: VectorDocument[] }
>();
function historyFor(id: string) {
  let history = documentHistory.get(id);
  if (!history) {
    if (documentHistory.size >= 10)
      documentHistory.delete(documentHistory.keys().next().value!);
    history = { undo: [], redo: [] };
    documentHistory.set(id, history);
  }
  return history;
}
let stopGenerationMonitor = () => {};
function monitorGeneration(jobId: string) {
  stopGenerationMonitor();
  stopGenerationMonitor = startGenerationMonitor(
    jobId,
    desktop.generationProgress,
    (value) => set({ generationProgress: value }),
    () => activeJob === jobId,
  );
}
function progressPhase(phase: GenerationProgress["phase"], message: string) {
  const progress = get().generationProgress;
  if (!progress) return;
  const now = Date.now();
  set({
    generationProgress: {
      ...progress,
      phase,
      message,
      updatedAt: now,
      logs: [...progress.logs, { at: now, message }].slice(-80),
    },
  });
}
const fail = (error: unknown) =>
  set({ error: desktop.message(error), status: "Action failed" });
async function initialize() {
  try {
    const loaded = await desktop.loadWorkspace();
    const workspace = loaded.snapshot || get().workspace;
    workspace.revision = loaded.revision;
    const firstBrand =
      workspace.brands.find((b) => b.status !== "archived") ??
      workspace.brands[0];
    set({
      workspace,
      selectedBrandId: firstBrand?.id || null,
      selectedConceptId:
        workspace.concepts.find((c) => c.brandId === firstBrand?.id)?.id ||
        null,
      ready: true,
      status: desktop.native
        ? "Saved on this device"
        : "Browser preview · stored in this browser",
    });
  } catch (error) {
    fail(error);
  }
  await Promise.all([
    actions.refreshProvider(),
    desktop.syncWindowTheme(get().theme).catch(fail),
  ]);
}
async function persist(
  transform: (workspace: Workspace) => Workspace,
  onSaved?: () => void,
): Promise<boolean> {
  pendingWrites++;
  let successful = false;
  const operation = writeQueue.then(async () => {
    if (!get().ready)
      throw new Error(
        "Workspace is unavailable. Reload the app after resolving the storage error.",
      );
    const current = get().workspace;
    const next = workspaceSchema.parse(transform(current));
    set({ status: "Saving…" });
    const revision = await desktop.saveWorkspace(next, current.revision);
    writeError = null;
    set({ workspace: { ...next, revision }, status: "Saved on this device" });
    successful = true;
    onSaved?.();
  });
  writeQueue = operation.catch((error) => {
    writeError = error;
    fail(error);
  });
  try {
    await writeQueue;
  } finally {
    pendingWrites--;
  }
  return successful;
}
async function flushWrites(): Promise<void> {
  let pending: Promise<void>;
  do {
    pending = writeQueue;
    await pending;
  } while (pending !== writeQueue);
  if (writeError) throw writeError;
}
function selectedConcept(id = get().selectedConceptId): Concept {
  const state = get();
  const concept = state.workspace.concepts.find((c) => c.id === id);
  if (!concept) throw new Error("Select a concept first.");
  return concept;
}
async function guarded(action: () => Promise<void>) {
  try {
    await action();
  } catch (error) {
    fail(error);
  }
}
function fileName(suffix: string, brandId = get().selectedBrandId) {
  const brand = get().workspace.brands.find((b) => b.id === brandId);
  return `${(brand?.name || "brand").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 80)}${suffix}`;
}
const actions = {
  selectBrand(id: string) {
    const workspace = get().workspace;
    if (!workspace.brands.some((b) => b.id === id)) return;
    set({
      selectedBrandId: id,
      selectedConceptId:
        workspace.concepts.find((c) => c.brandId === id)?.id || null,
    });
  },
  selectConcept(id: string) {
    const concept = get().workspace.concepts.find((c) => c.id === id);
    if (concept)
      set({ selectedConceptId: id, selectedBrandId: concept.brandId });
  },
  async createBrand(name: string, parentId?: string): Promise<boolean> {
    let created = false;
    await guarded(async () => {
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      if (
        await persist((w) => ({
          ...w,
          brands: [
            ...w.brands,
            {
              id,
              name: name.trim(),
              parentId: parentId || null,
              dna: parentId ? {} : { ...DEFAULT_DNA },
              createdAt,
            },
          ],
        }))
      ) {
        set({ selectedBrandId: id, selectedConceptId: null });
        created = true;
      }
    });
    return created;
  },
  async updateBrandName(name: string) {
    const id = get().selectedBrandId;
    await persist((w) => ({
      ...w,
      brands: w.brands.map((b) =>
        b.id === id ? { ...b, name: name.trim() } : b,
      ),
    }));
  },
  async updateBrand(
    id: string,
    patch: Partial<Pick<Brand, "name" | "status" | "icon">>,
  ): Promise<boolean> {
    let success = false;
    await guarded(async () => {
      const metadata = brandMetadataSchema.parse(patch);
      success = await persist((w) => {
        if (!w.brands.some((b) => b.id === id))
          throw new Error("Brand not found.");
        return {
          ...w,
          brands: w.brands.map((b) =>
            b.id === id
              ? {
                  ...b,
                  ...metadata,
                  ...(metadata.status === "archived" ? { pinned: false } : {}),
                }
              : b,
          ),
        };
      });
    });
    return success;
  },
  async pinBrand(id: string, pinned: boolean) {
    await persist((w) => ({
      ...w,
      brands: pinned
        ? reorderPinned(w.brands, id)
        : w.brands.map((b) => (b.id === id ? { ...b, pinned: false } : b)),
    }));
  },
  async reorderPinnedBrand(id: string, beforeId?: string) {
    await persist((w) => ({
      ...w,
      brands: reorderPinned(w.brands, id, beforeId),
    }));
  },
  async updateDna(patch: Partial<BrandDna>) {
    const id = get().selectedBrandId;
    await guarded(async () => {
      const validated = dnaSchema.partial().parse(patch);
      await persist((w) => ({
        ...w,
        brands: w.brands.map((b) =>
          b.id === id ? { ...b, dna: { ...b.dna, ...validated } } : b,
        ),
      }));
    });
  },
  async resetDna(key: keyof BrandDna) {
    const id = get().selectedBrandId;
    await persist((w) => ({
      ...w,
      brands: w.brands.map((b) => {
        if (b.id !== id) return b;
        const dna = { ...b.dna };
        delete dna[key];
        return { ...b, dna };
      }),
    }));
  },
  setPrompt(prompt: string) {
    set({ prompt: prompt.slice(0, 3000) });
  },
  setGenerationTarget(generationTarget: "symbol" | "full-logo") {
    set({ generationTarget });
  },
  reuseSubmittedPrompt() {
    const prompt = get().submittedPrompt;
    if (prompt !== null) set({ prompt });
  },
  async generate(provider: "procedural" | "local", count: number) {
    if (get().busy || get().referenceLoading) return;
    if (!Number.isInteger(count) || count < 1 || count > 4) {
      fail(new Error("Choose one to four concepts."));
      return;
    }
    if (get().pendingConcepts.length) {
      fail(
        new Error("Save or export the pending batch before generating again."),
      );
      return;
    }
    const brandId = get().selectedBrandId;
    const submittedPrompt = get().prompt;
    const referenceUrl = get().referenceUrl;
    const generationTarget = get().generationTarget;
    const jobId = crypto.randomUUID();
    activeJob = jobId;
    set({
      busy: true,
      cancellable: true,
      error: null,
      generationStartedAt: provider === "local" ? Date.now() : null,
      generationBrandId: brandId,
      generationBrandName:
        get().workspace.brands.find((b) => b.id === brandId)?.name ?? null,
      generationProgress:
        provider === "local"
          ? {
              jobId,
              phase: "starting",
              message: "Preparing local generation",
              imageIndex: 0,
              imageCount: count,
              updatedAt: Date.now(),
              logs: [],
            }
          : null,
      status:
        provider === "local"
          ? "Generating locally…"
          : "Composing vector studies…",
    });
    try {
      await flushWrites();
      if (activeJob !== jobId) return;
      const state = get();
      const brand = state.workspace.brands.find((b) => b.id === brandId);
      if (!brand) throw new Error("Create or select a brand first.");
      set({ generationBrandName: brand.name });
      if (brand.status === "archived")
        throw new Error("Restore this archived brand before generating.");
      if (!submittedPrompt.trim())
        throw new Error("Describe the logo you want to create.");
      if (get().prompt === submittedPrompt) set({ prompt: "" });
      set({ submittedPrompt });
      const dna = resolveDna(brand.id, state.workspace.brands);
      const seed = crypto.getRandomValues(new Uint32Array(1))[0] % 2147483647;
      const concepts = generateConcepts(
        brand.id,
        brand.name,
        submittedPrompt,
        dna,
        count,
        seed,
      );
      const effectivePrompt =
        buildPrompt(submittedPrompt, brand.name, dna) +
        (generationTarget === "symbol"
          ? " Create only the standalone symbol. No letters, words, lettering, slogans or typography; the studio adds editable text separately."
          : "");
      for (const concept of concepts) {
        concept.generationContext = {
          effectivePrompt:
            provider === "local" ? effectivePrompt : submittedPrompt,
          dna: structuredClone(dna),
          width: provider === "local" ? 512 : 640,
          height: provider === "local" ? 512 : 480,
        };
      }
      if (provider === "local") {
        monitorGeneration(jobId);
        const response = await desktop.generate({
          jobId,
          prompt: effectivePrompt,
          seed,
          count,
          width: 512,
          height: 512,
          ...(referenceUrl
            ? { referenceBase64: referenceUrl.split(",")[1] }
            : {}),
        });
        stopGenerationMonitor();
        const latest = await desktop
          .generationProgress(jobId)
          .catch(() => null);
        if (latest?.jobId === jobId && activeJob === jobId)
          set({ generationProgress: latest });
        if (response.images.length !== concepts.length)
          throw new Error(
            "Generation returned an incomplete batch. No partial batch was saved.",
          );
        response.images.forEach((image, index) => {
          Object.assign(concepts[index], {
            raster: `data:image/png;base64,${image.pngBase64}`,
            seed: image.seed,
            provider: response.provider,
            name: `AI concept ${index + 1}`,
            ...(referenceUrl ? { reference: referenceUrl } : {}),
          });
          if (generationTarget === "symbol")
            concepts[index].document.symbolSource = "image";
        });
      }
      if (activeJob !== jobId) return;
      set({
        cancellable: false,
        pendingConcepts: concepts,
        pendingRecoveryExported: false,
      });
      progressPhase(
        "saving",
        "Saving concepts and source images on this device",
      );
      if (
        await persist((w) => ({ ...w, concepts: [...w.concepts, ...concepts] }))
      ) {
        if (get().selectedBrandId === brand.id)
          set({ selectedConceptId: concepts[0].id });
        set({
          pendingConcepts: [],
          status: `${concepts.length} concepts saved`,
        });
        progressPhase("completed", `${concepts.length} concepts saved`);
      } else
        progressPhase(
          "failed",
          "Generation finished; saving failed. Retry save or export a recovery copy.",
        );
    } catch (error) {
      if (activeJob === jobId) {
        stopGenerationMonitor();
        const latest =
          provider === "local"
            ? await desktop.generationProgress(jobId).catch(() => null)
            : null;
        if (activeJob !== jobId) return;
        if (latest?.jobId === jobId) set({ generationProgress: latest });
        fail(error);
        progressPhase("failed", desktop.message(error));
      }
    } finally {
      stopGenerationMonitor();
      if (activeJob !== jobId) {
        progressPhase("cancelled", "Generation cancelled");
        set({ status: "Generation cancelled" });
      }
      if (activeJob === jobId) activeJob = null;
      set({ busy: false, cancellable: false });
    }
  },
  async retryPendingSave() {
    const concepts = get().pendingConcepts;
    if (!concepts.length || get().busy) return;
    set({ busy: true });
    progressPhase("saving", "Retrying the local save without regenerating");
    if (
      await persist((w) => ({
        ...w,
        concepts: [
          ...w.concepts,
          ...concepts.filter(
            (c) => !w.concepts.some((saved) => saved.id === c.id),
          ),
        ],
      }))
    ) {
      set({
        pendingConcepts: [],
        error: null,
        selectedBrandId: concepts[0].brandId,
        selectedConceptId: concepts[0].id,
      });
      progressPhase("completed", "Recovered concepts saved");
    } else
      progressPhase(
        "failed",
        "Saving still failed. The completed batch is retained.",
      );
    set({ busy: false });
  },
  async exportPendingBatch() {
    await guarded(async () => {
      const { pendingConcepts, workspace } = get();
      if (!pendingConcepts.length) return;
      const recovery = {
        schemaVersion: 1,
        brands: workspace.brands,
        concepts: pendingConcepts,
      };
      const saved = await desktop.exportFile(
        "javlogos-unsaved-batch.json",
        new TextEncoder().encode(JSON.stringify(recovery, null, 2)),
      );
      set({
        pendingRecoveryExported: saved,
        status: saved
          ? "Recovery batch exported; retry saving before closing"
          : "Export cancelled",
      });
    });
  },
  async importRecoveryFile(file: File) {
    await guarded(async () => {
      if (file.size > 128 * 1024 * 1024)
        throw new Error("Recovery file exceeds 128 MiB.");
      const recovery = workspaceSchema.parse({
        ...JSON.parse(await file.text()),
        revision: 0,
      });
      for (const concept of recovery.concepts)
        if (concept.tracedSvg)
          concept.tracedSvg = sanitizeSvg(concept.tracedSvg);
      const saved = await persist((w) => ({
        ...w,
        brands: [
          ...w.brands,
          ...recovery.brands.filter(
            (b) => !w.brands.some((existing) => existing.id === b.id),
          ),
        ],
        concepts: [
          ...w.concepts,
          ...recovery.concepts.filter(
            (c) => !w.concepts.some((existing) => existing.id === c.id),
          ),
        ],
      }));
      if (saved && recovery.concepts[0])
        set({
          selectedBrandId: recovery.concepts[0].brandId,
          selectedConceptId: recovery.concepts[0].id,
          status: "Recovery batch imported",
        });
    });
  },
  async cancelGeneration() {
    const jobId = activeJob;
    if (!jobId || !get().cancellable) return;
    activeJob = null;
    stopGenerationMonitor();
    set({ cancellable: false, status: "Cancelling generation…" });
    await guarded(async () => {
      await desktop.cancel(jobId);
    });
  },
  async updateConcept(patch: Partial<VectorDocument>, replace = false) {
    const id = get().selectedConceptId;
    const captured = structuredClone(patch);
    await guarded(async () => {
      let previous: VectorDocument | undefined;
      await persist(
        (w) => ({
          ...w,
          concepts: w.concepts.map((c) =>
            c.id === id
              ? ((previous = structuredClone(c.document)),
                {
                  ...c,
                  document: documentSchema.parse(
                    replace ? captured : { ...c.document, ...captured },
                  ),
                })
              : c,
          ),
        }),
        () => {
          if (id && previous) {
            const history = historyFor(id);
            history.undo.push(previous);
            history.undo = history.undo.slice(-40);
            history.redo = [];
            set({ historyRevision: get().historyRevision + 1 });
          }
        },
      );
    });
  },
  async undoConcept() {
    await changeHistory("undo");
  },
  async redoConcept() {
    await changeHistory("redo");
  },
  async updateConceptMetadata(
    id: string,
    patch: Partial<Pick<Concept, "name" | "favorite" | "notes">>,
  ) {
    await persist((w) => ({
      ...w,
      concepts: w.concepts.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  },
  async deleteConcept(id: string): Promise<boolean> {
    if (get().busy || deletingConcepts.has(id)) return false;
    deletingConcepts.add(id);
    let saved = false;
    await guarded(async () => {
      const concept = selectedConcept(id);
      let replacement: string | null = null;
      saved = await persist(
        (workspace) => {
          const siblings = workspace.concepts.filter(
            (item) => item.brandId === concept.brandId,
          );
          const index = siblings.findIndex((item) => item.id === id);
          if (index < 0)
            throw new Error("This concept is no longer available.");
          replacement =
            siblings[index + 1]?.id ?? siblings[index - 1]?.id ?? null;
          return {
            ...workspace,
            concepts: workspace.concepts.filter((item) => item.id !== id),
          };
        },
        () => {
          documentHistory.delete(id);
          set({
            ...(get().selectedConceptId === id
              ? { selectedConceptId: replacement }
              : {}),
            historyRevision: get().historyRevision + 1,
            status: "Concept deleted",
          });
        },
      );
    });
    deletingConcepts.delete(id);
    return saved;
  },
  async updateBrandDna(id: string, patch: Partial<BrandDna>): Promise<boolean> {
    let saved = false;
    await guarded(async () => {
      const validated = dnaSchema.partial().parse(patch);
      saved = await persist((w) => ({
        ...w,
        brands: w.brands.map((b) =>
          b.id === id ? { ...b, dna: { ...b.dna, ...validated } } : b,
        ),
      }));
    });
    return saved;
  },
  async updateBrandBook(patch: NonNullable<Brand["book"]>) {
    const id = get().selectedBrandId;
    await guarded(async () => {
      const validated = bookSchema.parse(patch);
      await persist((w) => ({
        ...w,
        brands: w.brands.map((b) =>
          b.id === id ? { ...b, book: { ...b.book, ...validated } } : b,
        ),
      }));
    });
  },
  async startCustomSymbol() {
    await guarded(async () => {
      const concept = selectedConcept();
      await actions.updateConcept({
        symbolSource: "custom",
        paths: createStarterPaths(concept.document.primary),
        monochrome: false,
        motion: "none",
      });
    });
  },
  async editTracedSymbol() {
    await guarded(async () => {
      const concept = selectedConcept();
      if (!concept.tracedSvg)
        throw new Error("Trace the original image first.");
      await actions.updateConcept({
        symbolSource: "custom",
        paths: importTracePaths(concept.tracedSvg),
        monochrome: false,
        motion: "none",
      });
    });
  },
  async saveVersion() {
    const id = get().selectedConceptId;
    await persist((w) => ({
      ...w,
      concepts: w.concepts.map((c) =>
        c.id === id
          ? {
              ...c,
              versions: [
                ...c.versions,
                {
                  id: crypto.randomUUID(),
                  createdAt: new Date().toISOString(),
                  document: structuredClone(c.document),
                },
              ],
            }
          : c,
      ),
    }));
  },
  async restoreVersion(versionId: string) {
    await guarded(async () => {
      const concept = selectedConcept();
      const version = concept.versions.find((v) => v.id === versionId);
      if (!version) throw new Error("Version not found.");
      await actions.updateConcept(version.document, true);
    });
  },
  async vectorizeConcept() {
    if (get().busy) return;
    set({ busy: true, status: "Tracing image…" });
    await guarded(async () => {
      const concept = selectedConcept();
      if (!concept.raster) throw new Error("Select an AI image to trace.");
      const tracedSvg = sanitizeSvg(
        await desktop.vectorize(concept.raster.split(",")[1]),
      );
      await persist((w) => ({
        ...w,
        concepts: w.concepts.map((c) =>
          c.id === concept.id ? { ...c, tracedSvg } : c,
        ),
      }));
    });
    set({ busy: false });
  },
  async exportSvg(target?: "composition" | "trace") {
    const id = get().selectedConceptId;
    await guarded(async () => {
      await flushWrites();
      const concept = selectedConcept(id);
      const useTrace =
        target === "trace" || (!target && Boolean(concept.tracedSvg));
      if (useTrace && !concept.tracedSvg)
        throw new Error("Trace this image first.");
      const svg = useTrace
        ? sanitizeSvg(concept.tracedSvg!)
        : await prepareCompositionSvg(
            concept.document,
            compositionAsset(concept),
          );
      const saved = await desktop.exportFile(
        fileName(useTrace ? "-trace.svg" : "-composition.svg", concept.brandId),
        new TextEncoder().encode(svg),
      );
      set({ status: saved ? "SVG exported" : "Export cancelled" });
    });
  },
  async exportPng(target?: "composition" | "trace" | "original") {
    const id = get().selectedConceptId;
    await guarded(async () => {
      await flushWrites();
      const concept = selectedConcept(id);
      const mode =
        target ||
        (concept.tracedSvg
          ? "trace"
          : concept.raster
            ? "original"
            : "composition");
      if (mode === "original" && !concept.raster)
        throw new Error("No original raster image.");
      if (mode === "trace" && !concept.tracedSvg)
        throw new Error("Trace this image first.");
      const bytes =
        mode === "original"
          ? Uint8Array.from(atob(concept.raster!.split(",")[1]), (c) =>
              c.charCodeAt(0),
            )
          : await rasterize(
              mode === "trace"
                ? sanitizeSvg(concept.tracedSvg!)
                : await prepareCompositionSvg(
                    concept.document,
                    compositionAsset(concept),
                  ),
            );
      const saved = await desktop.exportFile(
        fileName(`-${mode}.png`, concept.brandId),
        bytes,
      );
      set({ status: saved ? "PNG exported" : "Export cancelled" });
    });
  },
  async exportKit() {
    const brandId = get().selectedBrandId;
    await guarded(async () => {
      await flushWrites();
      const state = get();
      if (!brandId) throw new Error("Select a brand first.");
      const bytes = await buildKit(state.workspace, brandId);
      const saved = await desktop.exportFile(
        fileName("-brand-kit.zip", brandId),
        bytes,
      );
      set({ status: saved ? "Brand kit exported" : "Export cancelled" });
    });
  },
  async exportMotion() {
    const id = get().selectedConceptId;
    await guarded(async () => {
      await flushWrites();
      const concept = selectedConcept(id);
      const svg = await embedFont(
        renderMotionSvg(concept.document, compositionAsset(concept)),
        concept.document.fontFamily,
      );
      const saved = await desktop.exportFile(
        fileName("-animated.svg", concept.brandId),
        new TextEncoder().encode(svg),
      );
      set({ status: saved ? "Animated SVG exported" : "Export cancelled" });
    });
  },
  async exportBrandBook(mode: "composition" | "original" = "composition") {
    const id = get().selectedBrandId;
    const conceptId = get().selectedConceptId;
    await guarded(async () => {
      await flushWrites();
      if (!id) throw new Error("Select a brand first.");
      const html = await buildBrandBook(
        get().workspace,
        id,
        conceptId ?? undefined,
        mode,
      );
      const saved = await desktop.exportFile(
        fileName("-brand-book.html", id),
        new TextEncoder().encode(html),
      );
      set({ status: saved ? "Brand book exported" : "Export cancelled" });
    });
  },
  async importReference(file: File) {
    const sequence = ++referenceSequence;
    set({ referenceLoading: true });
    try {
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        file.size > 10_000_000
      )
        throw new Error("Choose a PNG, JPEG or WebP reference under 10 MB.");
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () =>
          reject(new Error("Reference could not be read."));
        reader.readAsDataURL(file);
      });
      if (sequence !== referenceSequence) return;
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Reference image is invalid."));
        image.src = data;
      });
      if (sequence !== referenceSequence) return;
      if (image.width * image.height > 40_000_000)
        throw new Error("Reference exceeds 40 megapixels.");
      const ratio = Math.min(1, 1024 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * ratio);
      canvas.height = Math.round(image.height * ratio);
      canvas
        .getContext("2d")!
        .drawImage(image, 0, 0, canvas.width, canvas.height);
      set({
        referenceUrl: canvas.toDataURL("image/png"),
        referenceInfo: {
          name: file.name,
          width: image.width,
          height: image.height,
          size: file.size,
        },
        status: "Reference added",
      });
    } catch (error) {
      if (sequence === referenceSequence) fail(error);
    } finally {
      if (sequence === referenceSequence) set({ referenceLoading: false });
    }
  },
  async refineConcept() {
    await guarded(async () => {
      const concept = selectedConcept();
      if (!concept.raster)
        throw new Error("Select an AI image to use as a reference.");
      const bytes = Uint8Array.from(
        atob(concept.raster.split(",")[1]),
        (character) => character.charCodeAt(0),
      );
      await actions.importReference(
        new File([bytes], `${concept.name}.png`, { type: "image/png" }),
      );
      actions.setPrompt(concept.prompt);
    });
  },
  clearReference() {
    referenceSequence++;
    set({ referenceUrl: null, referenceInfo: null, referenceLoading: false });
  },
  async refreshProvider() {
    try {
      set({ providerHealth: await desktop.health() });
    } catch (error) {
      set({
        providerHealth: {
          available: false,
          provider: "Local runtime",
          message: desktop.message(error),
        },
      });
    }
  },
  dismissError() {
    set({ error: null });
  },
  setTheme(theme: "light" | "dark") {
    localStorage.setItem("javlogos.theme", theme);
    set({ theme });
    void desktop.syncWindowTheme(theme).catch(fail);
  },
};
export function useStudio() {
  const state = useState();
  useEffect(() => {
    initialization ??= initialize();
    if (activeJob && get().generationProgress) monitorGeneration(activeJob);
    let disposed = false;
    let stop: (() => void) | undefined;
    void desktop
      .watchClose(
        () => {
          if (document.activeElement instanceof HTMLElement)
            document.activeElement.blur();
          return (
            pendingWrites > 0 ||
            get().busy ||
            (get().pendingConcepts.length > 0 && !get().pendingRecoveryExported)
          );
        },
        () =>
          fail(
            new Error(
              "Finish or cancel the current action, and save or export any recovery batch before closing.",
            ),
          ),
      )
      .then((unlisten) => {
        if (disposed) unlisten();
        else stop = unlisten;
      })
      .catch(fail);
    return () => {
      disposed = true;
      stop?.();
      stopGenerationMonitor();
    };
  }, []);
  const selectedBrand = state.workspace.brands.find(
    (b) => b.id === state.selectedBrandId,
  );
  const concept = state.workspace.concepts.find(
    (c) => c.id === state.selectedConceptId,
  );
  const resolvedDna = useMemo(
    () =>
      selectedBrand
        ? resolveDna(selectedBrand.id, state.workspace.brands)
        : DEFAULT_DNA,
    [selectedBrand, state.workspace.brands],
  );
  return {
    ...state,
    ...actions,
    native: desktop.native,
    selectedBrand,
    selectedConcept: concept,
    resolvedDna,
    canUndo: Boolean(concept && documentHistory.get(concept.id)?.undo.length),
    canRedo: Boolean(concept && documentHistory.get(concept.id)?.redo.length),
  };
}
async function changeHistory(direction: "undo" | "redo") {
  const id = get().selectedConceptId;
  if (!id) return;
  await guarded(async () => {
    let current: VectorDocument | undefined;
    const history = historyFor(id);
    await persist(
      (w) => {
        const target = history[direction].at(-1);
        if (!target) return w;
        return {
          ...w,
          concepts: w.concepts.map((c) => {
            if (c.id !== id) return c;
            current = structuredClone(c.document);
            return { ...c, document: structuredClone(target) };
          }),
        };
      },
      () => {
        if (!current) return;
        history[direction].pop();
        history[direction === "undo" ? "redo" : "undo"].push(current);
        set({ historyRevision: get().historyRevision + 1 });
      },
    );
  });
}
