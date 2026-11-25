import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Cpu,
  FileImage,
  LoaderCircle,
  Square,
  Terminal,
} from "lucide-react";
import type { StudioState } from "./ui";

export const generationPhaseLabels: Record<string, string> = {
  starting: "Starting local generation",
  loading: "Loading model",
  encoding: "Encoding your direction",
  sampling: "Generating image",
  decoding: "Decoding image",
  "image-ready": "Image completed",
  saving: "Saving your concepts",
  completed: "Generation complete",
  cancelled: "Generation cancelled",
  failed: "Generation failed",
};
const terminalPhases = ["completed", "cancelled", "failed"];
export function generationIsActive(studio: StudioState): boolean {
  return (
    studio.busy &&
    studio.generationStartedAt !== null &&
    !terminalPhases.includes(studio.generationProgress?.phase || "starting")
  );
}
function elapsedLabel(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function GenerationProgressPanel({
  studio,
  compact = false,
}: {
  studio: StudioState;
  compact?: boolean;
}) {
  const progress = studio.generationProgress;
  const active = generationIsActive(studio);
  const [now, setNow] = useState(() => Date.now());
  const logViewport = useRef<HTMLOListElement>(null);
  const followLog = useRef(true);
  useEffect(() => {
    setNow(Date.now());
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active, studio.generationStartedAt]);
  const logs = progress?.logs || [];
  const latest = logs.at(-1);
  useEffect(() => {
    if (followLog.current && logViewport.current)
      logViewport.current.scrollTop = logViewport.current.scrollHeight;
  }, [latest?.at, latest?.message]);

  const phase = progress?.phase || "starting";
  const title = generationPhaseLabels[phase] || "Local generation";
  const end = active ? now : progress?.updatedAt || now;
  const elapsed =
    studio.generationStartedAt === null
      ? null
      : elapsedLabel(end - studio.generationStartedAt);
  const quietSeconds = progress
    ? Math.max(0, Math.floor((now - progress.updatedAt) / 1000))
    : studio.generationStartedAt === null
      ? 0
      : Math.max(0, Math.floor((now - studio.generationStartedAt) / 1000));
  const stepKnown =
    phase === "sampling" &&
    progress?.step !== undefined &&
    progress.steps !== undefined &&
    progress.steps > 0 &&
    progress.step >= 0 &&
    progress.step <= progress.steps;
  const imageKnown = Boolean(
    progress && progress.imageIndex > 0 && progress.imageCount > 0,
  );

  return (
    <section
      className={`generation-progress ${compact ? "compact" : ""}`}
      aria-label="Generation activity"
    >
      <div className="generation-progress-heading">
        <div
          className={`generation-phase-icon ${phase === "failed" ? "failed" : ""}`}
        >
          {active ? (
            <LoaderCircle className="spin" size={23} />
          ) : phase === "completed" ? (
            <CheckCircle2 size={23} />
          ) : (
            <AlertCircle size={23} />
          )}
        </div>
        <div>
          <h2 role="status">{title}</h2>
          {studio.generationBrandName && (
            <span className="generation-brand">
              For {studio.generationBrandName}
            </span>
          )}
          <p>
            {progress?.message ||
              "Waiting for the local worker to report its first update."}
          </p>
        </div>
        {active && studio.cancellable && (
          <button
            type="button"
            className="outline-button"
            onClick={() => void studio.cancelGeneration()}
          >
            <Square size={12} /> Cancel generation
          </button>
        )}
      </div>
      <dl className="generation-metrics">
        <div>
          <dt>
            <Clock3 size={13} /> Elapsed
          </dt>
          <dd>{elapsed ?? "—"}</dd>
        </div>
        <div>
          <dt>
            <FileImage size={13} /> Current image
          </dt>
          <dd>
            {imageKnown
              ? `${progress!.imageIndex} of ${progress!.imageCount}`
              : "Waiting"}
          </dd>
        </div>
        <div>
          <dt>
            <Cpu size={13} /> Provider
          </dt>
          <dd>{studio.providerHealth.provider || "Local worker"}</dd>
        </div>
      </dl>
      {stepKnown && (
        <div className="generation-step">
          <div>
            <span>Diffusion steps</span>
            <strong>
              {progress!.step} / {progress!.steps}
            </strong>
          </div>
          <progress
            aria-label="Diffusion steps for current image"
            value={progress!.step}
            max={progress!.steps}
          />
        </div>
      )}
      {active && quietSeconds >= 20 && (
        <p className="generation-quiet" role="status">
          <Clock3 size={14} />
          <span>
            No new activity for {quietSeconds}s.{" "}
            {phase === "saving"
              ? "The local save has not completed yet."
              : studio.cancellable
                ? "Loading or computation may still be running; cancellation remains available."
                : "Waiting for the current operation to finish."}
          </span>
        </p>
      )}
      {progress?.previewBase64 && (
        <figure className="generation-image-ready">
          <img
            src={`data:image/png;base64,${progress.previewBase64}`}
            alt="Most recent completed generated image"
          />
          <figcaption>
            Most recent completed image
            <span>
              This is an available result, not a live diffusion preview.
            </span>
          </figcaption>
        </figure>
      )}
      <details className="generation-log" open={active || undefined}>
        <summary>
          <Terminal size={14} /> Activity log{" "}
          <span>
            {logs.length
              ? `${logs.length} recent entries`
              : "Waiting for worker"}
          </span>
        </summary>
        {logs.length ? (
          <ol
            ref={logViewport}
            tabIndex={0}
            aria-label="Recent worker activity"
            onScroll={(event) => {
              const element = event.currentTarget;
              followLog.current =
                element.scrollHeight -
                  element.scrollTop -
                  element.clientHeight <
                32;
            }}
          >
            {logs.map((line, index) => (
              <li key={`${line.at}-${index}`}>
                <time dateTime={new Date(line.at).toISOString()}>
                  {new Date(line.at).toLocaleTimeString([], { hour12: false })}
                </time>
                <span>{line.message}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="generation-log-empty">
            No diagnostics received yet. Updates appear here as the worker
            reports them.
          </p>
        )}
      </details>
      {!compact && (
        <p className="generation-explanation">
          Your brand rules and reference guide the local model. JavLogos saves
          the concepts when the batch finishes.
        </p>
      )}
    </section>
  );
}
