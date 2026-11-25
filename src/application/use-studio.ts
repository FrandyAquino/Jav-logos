import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { DEFAULT_DNA, buildPrompt, resolveDna } from "../domain/brand-dna";
import { generateConcepts, renderSvg } from "../domain/vector";
import { dnaSchema, documentSchema, workspaceSchema } from "../domain/schema";
import type {
  BrandDna,
  Concept,
  ProviderHealth,
  VectorDocument,
  Workspace,
} from "../domain/types";
import * as desktop from "../infrastructure/desktop";
import { buildKit, rasterize } from "../infrastructure/export";
import { sanitizeSvg } from "../infrastructure/svg";

interface StudioState {
  workspace: Workspace;
  selectedBrandId: string | null;
  selectedConceptId: string | null;
  prompt: string;
  status: string;
  error: string | null;
  busy: boolean;
  ready: boolean;
  cancellable: boolean;
  providerHealth: ProviderHealth;
  theme: "light" | "dark";
  referenceUrl: string | null;
  pendingConcepts: Concept[];
  pendingRecoveryExported: boolean;
}
const useState = create<StudioState>(() => ({
  workspace: { schemaVersion: 1, revision: 0, brands: [], concepts: [] },
  selectedBrandId: null,
  selectedConceptId: null,
  prompt: "A distinctive geometric mark with a confident, timeless silhouette",
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
const fail = (error: unknown) =>
  set({ error: desktop.message(error), status: "Action failed" });
async function initialize() {
  try {
    const loaded = await desktop.loadWorkspace();
    const workspace = loaded.snapshot || get().workspace;
    workspace.revision = loaded.revision;
    set({
      workspace,
      selectedBrandId: workspace.brands[0]?.id || null,
      selectedConceptId:
        workspace.concepts.find((c) => c.brandId === workspace.brands[0]?.id)
          ?.id || null,
      ready: true,
      status: desktop.native
        ? "Saved on this device"
        : "Browser preview · stored in this browser",
    });
  } catch (error) {
    fail(error);
  }
  await actions.refreshProvider();
}
async function persist(
  transform: (workspace: Workspace) => Workspace,
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
  async generate(provider: "procedural" | "local", count: number) {
    if (get().busy) return;
    if (get().pendingConcepts.length) {
      fail(
        new Error("Save or export the pending batch before generating again."),
      );
      return;
    }
    const brandId = get().selectedBrandId;
    const jobId = crypto.randomUUID();
    activeJob = jobId;
    set({
      busy: true,
      cancellable: true,
      error: null,
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
      if (!state.prompt.trim())
        throw new Error("Describe the logo you want to create.");
      const dna = resolveDna(brand.id, state.workspace.brands);
      const seed = crypto.getRandomValues(new Uint32Array(1))[0] % 2147483647;
      const concepts = generateConcepts(
        brand.id,
        brand.name,
        state.prompt,
        dna,
        count,
        seed,
      );
      const effectivePrompt = buildPrompt(state.prompt, brand.name, dna);
      for (const concept of concepts) {
        concept.generationContext = {
          effectivePrompt:
            provider === "local" ? effectivePrompt : state.prompt,
          dna: structuredClone(dna),
          width: provider === "local" ? 512 : 640,
          height: provider === "local" ? 512 : 480,
        };
      }
      if (provider === "local") {
        const response = await desktop.generate({
          jobId,
          prompt: effectivePrompt,
          seed,
          count,
          width: 512,
          height: 512,
          ...(state.referenceUrl
            ? { referenceBase64: state.referenceUrl.split(",")[1] }
            : {}),
        });
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
            ...(state.referenceUrl ? { reference: state.referenceUrl } : {}),
          });
        });
      }
      if (activeJob !== jobId) return;
      set({
        cancellable: false,
        pendingConcepts: concepts,
        pendingRecoveryExported: false,
      });
      if (
        await persist((w) => ({ ...w, concepts: [...w.concepts, ...concepts] }))
      ) {
        if (get().selectedBrandId === brand.id)
          set({ selectedConceptId: concepts[0].id });
        set({
          pendingConcepts: [],
          status: `${concepts.length} concepts saved`,
        });
      }
    } catch (error) {
      if (activeJob === jobId) fail(error);
    } finally {
      if (activeJob === jobId) activeJob = null;
      set({ busy: false, cancellable: false });
    }
  },
  async retryPendingSave() {
    const concepts = get().pendingConcepts;
    if (!concepts.length || get().busy) return;
    set({ busy: true });
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
    }
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
    set({ cancellable: false, status: "Cancelling generation…" });
    await guarded(async () => {
      await desktop.cancel(jobId);
      set({ status: "Generation cancelled" });
    });
  },
  async updateConcept(patch: Partial<VectorDocument>) {
    const id = get().selectedConceptId;
    await guarded(async () => {
      await persist((w) => ({
        ...w,
        concepts: w.concepts.map((c) =>
          c.id === id
            ? {
                ...c,
                document: documentSchema.parse({ ...c.document, ...patch }),
              }
            : c,
        ),
      }));
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
                  document: { ...c.document },
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
      await actions.updateConcept(version.document);
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
        : renderSvg(concept.document);
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
                : renderSvg(concept.document),
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
  async importReference(file: File) {
    const sequence = ++referenceSequence;
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
        status: "Reference added",
      });
    } catch (error) {
      if (sequence === referenceSequence) fail(error);
    }
  },
  clearReference() {
    referenceSequence++;
    set({ referenceUrl: null });
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
  },
};
export function useStudio() {
  const state = useState();
  useEffect(() => {
    initialization ??= initialize();
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
  };
}
