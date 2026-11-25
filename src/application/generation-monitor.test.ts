import { expect, it, vi } from "vitest";
import { startGenerationMonitor } from "./generation-monitor";
import type { GenerationProgress } from "../domain/types";
it("does not overlap polls or publish after cancellation", async () => {
  vi.useFakeTimers();
  let resolve!: (value: GenerationProgress) => void;
  const read = vi.fn(
    () =>
      new Promise<GenerationProgress>((done) => {
        resolve = done;
      }),
  );
  const emit = vi.fn();
  const stop = startGenerationMonitor("job", read, emit, () => true);
  await vi.advanceTimersByTimeAsync(2000);
  expect(read).toHaveBeenCalledTimes(1);
  stop();
  resolve({
    jobId: "job",
    phase: "sampling",
    message: "step",
    imageIndex: 1,
    imageCount: 2,
    updatedAt: 1,
    logs: [],
  });
  await Promise.resolve();
  await vi.advanceTimersByTimeAsync(2000);
  expect(emit).not.toHaveBeenCalled();
  expect(read).toHaveBeenCalledTimes(1);
  vi.useRealTimers();
});
