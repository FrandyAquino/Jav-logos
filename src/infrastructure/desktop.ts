import { invoke, isTauri } from "@tauri-apps/api/core";
import { workspaceSchema } from "../domain/schema";
import { sanitizeSvg } from "./svg";
import type {
  GenerationRequest,
  GenerationResult,
  ProviderHealth,
  Workspace,
} from "../domain/types";
const KEY = "javlogos.workspace.v1";
export const native = isTauri();
export async function watchClose(
  shouldBlock: () => boolean,
  onBlocked: () => void,
): Promise<() => void> {
  if (native) {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    return getCurrentWindow().onCloseRequested((event) => {
      if (shouldBlock()) {
        event.preventDefault();
        onBlocked();
      }
    });
  }
  const handle = (event: BeforeUnloadEvent) => {
    if (shouldBlock()) {
      event.preventDefault();
      onBlocked();
    }
  };
  window.addEventListener("beforeunload", handle);
  return () => window.removeEventListener("beforeunload", handle);
}
export async function loadWorkspace(): Promise<{
  snapshot: Workspace | null;
  revision: number;
}> {
  const result = native
    ? await invoke<{ snapshot: unknown; revision: number }>("load_workspace")
    : JSON.parse(localStorage.getItem(KEY) || '{"snapshot":null,"revision":0}');
  const snapshot = result.snapshot
    ? workspaceSchema.parse(result.snapshot)
    : null;
  if (snapshot)
    for (const concept of snapshot.concepts)
      if (concept.tracedSvg) concept.tracedSvg = sanitizeSvg(concept.tracedSvg);
  return {
    snapshot,
    revision: result.revision,
  };
}
export async function saveWorkspace(
  snapshot: Workspace,
  expectedRevision: number,
): Promise<number> {
  workspaceSchema.parse(snapshot);
  if (native) return invoke("save_workspace", { snapshot, expectedRevision });
  const current = JSON.parse(localStorage.getItem(KEY) || '{"revision":0}');
  if (current.revision !== expectedRevision)
    throw new Error(
      "Workspace changed in another window. Reload before saving.",
    );
  const revision = expectedRevision + 1;
  localStorage.setItem(
    KEY,
    JSON.stringify({ snapshot: { ...snapshot, revision }, revision }),
  );
  return revision;
}
export async function health(): Promise<ProviderHealth> {
  return native
    ? invoke("provider_health")
    : {
        available: false,
        provider: "Desktop required",
        message:
          "Local AI runs in the desktop app. Procedural vectors work in this browser preview.",
      };
}
export async function generate(
  request: GenerationRequest,
): Promise<GenerationResult> {
  if (!native) throw new Error("Open the desktop application to run local AI.");
  return invoke("generate_images", { request });
}
export async function cancel(jobId: string): Promise<boolean> {
  return native ? invoke("cancel_generation", { jobId }) : false;
}
export async function vectorize(pngBase64: string): Promise<string> {
  if (!native) throw new Error("Vector tracing requires the desktop worker.");
  return invoke("vectorize_image", { pngBase64 });
}
export async function exportFile(
  suggestedName: string,
  bytes: Uint8Array,
): Promise<boolean> {
  if (native)
    return (
      (await invoke<string | null>("export_file", {
        suggestedName,
        bytes: Array.from(bytes),
      })) !== null
    );
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)]));
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
export function message(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error)
    return String(error.message);
  return String(error);
}
