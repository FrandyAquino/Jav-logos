import type { GenerationProgress } from "../domain/types";
export function startGenerationMonitor(
  jobId: string,
  read: (id: string) => Promise<GenerationProgress | null>,
  emit: (value: GenerationProgress) => void,
  isCurrent: () => boolean,
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const poll = async () => {
    if (stopped || !isCurrent()) return;
    try {
      const value = await read(jobId);
      if (value?.jobId === jobId && !stopped && isCurrent()) emit(value);
    } catch {
      /* Generation owns its terminal error; a temporary diagnostics failure must not cancel inference. */
    }
    if (!stopped && isCurrent()) timer = setTimeout(() => void poll(), 500);
  };
  void poll();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
