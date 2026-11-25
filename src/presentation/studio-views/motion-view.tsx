import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Pause, Play, RotateCcw, Square } from "lucide-react";
import { renderMotionSvg } from "../../domain/vector";
import { compositionAsset } from "../../infrastructure/composition";
import type { VectorDocument } from "../../domain/types";
import { SelectField } from "../select-field";
import type { StudioState } from "../ui";
import { ViewEmpty, ViewHeading } from "./view-primitives";
type Playback = "idle" | "running" | "paused" | "finished";
export function MotionView({ studio }: { studio: StudioState }) {
  const concept = studio.selectedConcept;
  const [playback, setPlayback] = useState<Playback>("idle");
  const [replay, setReplay] = useState(0);
  const [reduced, setReduced] = useState(
    () =>
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const preview = useRef<HTMLDivElement>(null);
  const preset = concept?.document.motion ?? "none";
  const source = concept?.document.symbolSource ?? "geometric";
  const canDraw = Boolean(
    concept &&
    ["geometric", "custom"].includes(source) &&
    concept.document.showSymbol !== false &&
    concept.document.layout !== "wordmark" &&
    !(source === "geometric" && concept.document.shape === "monogram"),
  );
  const unsupportedDraw = preset === "draw" && !canDraw;
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    setPlayback("idle");
  }, [concept?.id, preset]);
  const rendered = useMemo(() => {
    if (!concept) return { svg: "", error: "" };
    try {
      const document = {
        ...concept.document,
        motion: reduced || playback === "idle" ? ("none" as const) : preset,
      };
      return {
        svg: renderMotionSvg(document, compositionAsset(concept)),
        error: "",
      };
    } catch (error) {
      return {
        svg: "",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }, [concept, preset, playback === "idle", reduced]);
  useEffect(() => {
    if (playback !== "running" || !preview.current) return;
    let current = true;
    const animations = preview.current.getAnimations({ subtree: true });
    if (!animations.length) {
      setPlayback("finished");
      return;
    }
    void Promise.all(
      animations.map((animation) => animation.finished.catch(() => undefined)),
    ).then(() => {
      if (current) setPlayback("finished");
    });
    return () => {
      current = false;
    };
  }, [playback, replay, rendered.svg]);
  const select = (motion: string) => {
    setPlayback("idle");
    void studio.updateConcept({ motion: motion as VectorDocument["motion"] });
  };
  const play = () => {
    if (playback === "paused") setPlayback("running");
    else {
      setReplay((value) => value + 1);
      setPlayback("running");
    }
  };
  return (
    <section className="exploration-view motion-view" aria-label="Logo motion">
      <ViewHeading
        title="Give the mark a purposeful entrance"
        description="Animate the editable composition. Original generated images and saved versions remain intact."
      />
      {!concept ? (
        <ViewEmpty title="Select a concept">
          Choose a concept to prepare an animated logo.
        </ViewEmpty>
      ) : (
        <>
          <div className="exploration-toolbar">
            <SelectField
              label="Motion preset"
              value={preset}
              disabled={studio.busy}
              onValueChange={select}
              options={[
                { value: "none", label: "Static" },
                { value: "fade", label: "Fade in" },
                { value: "assemble", label: "Assemble" },
                ...(canDraw ? [{ value: "draw", label: "Draw paths" }] : []),
              ]}
            />
            <button
              type="button"
              className="outline-button"
              disabled={
                preset === "none" ||
                unsupportedDraw ||
                studio.busy ||
                Boolean(rendered.error)
              }
              onClick={() => void studio.exportMotion()}
            >
              <Download size={14} />
              Export animated SVG
            </button>
          </div>
          {unsupportedDraw && (
            <p className="exploration-note" role="status">
              Draw needs visible editable paths. Choose Fade in or Assemble for
              live text or image-based symbols.
            </p>
          )}
          {rendered.error ? (
            <p className="dialog-error" role="alert">
              {rendered.error}
            </p>
          ) : (
            <div className="motion-stage">
              <div
                key={`${concept.id}-${replay}`}
                ref={preview}
                className="motion-preview"
                data-playback={playback}
                role="img"
                aria-label={`${concept.name} motion preview`}
                dangerouslySetInnerHTML={{ __html: rendered.svg }}
              />
            </div>
          )}
          <div className="motion-transport">
            <button
              type="button"
              className="primary-button"
              disabled={
                preset === "none" ||
                unsupportedDraw ||
                reduced ||
                Boolean(rendered.error)
              }
              onClick={
                playback === "running" ? () => setPlayback("paused") : play
              }
            >
              {playback === "running" ? (
                <Pause size={15} />
              ) : (
                <Play size={15} />
              )}{" "}
              {playback === "running"
                ? "Pause animation"
                : playback === "paused"
                  ? "Resume animation"
                  : "Play animation"}
            </button>
            <button
              type="button"
              className="outline-button"
              disabled={
                preset === "none" ||
                unsupportedDraw ||
                reduced ||
                Boolean(rendered.error)
              }
              onClick={() => {
                setReplay((value) => value + 1);
                setPlayback("running");
              }}
            >
              <RotateCcw size={14} />
              Replay
            </button>
            <button
              type="button"
              className="subtle-button"
              disabled={playback === "idle"}
              onClick={() => setPlayback("idle")}
            >
              <Square size={13} />
              Reset
            </button>
            <span role="status">
              {reduced
                ? "Reduced motion enabled"
                : preset === "none"
                  ? "Choose a preset"
                  : playback === "finished"
                    ? "Playback complete"
                    : playback === "paused"
                      ? "Paused"
                      : playback === "running"
                        ? "Playing once"
                        : "Ready"}
            </span>
          </div>
          <p className="exploration-note">
            {reduced
              ? "Your system preference keeps this preview still. Exported animation also includes a reduced-motion fallback."
              : "Playback runs once. SVG animation support depends on the app that opens the exported file."}
          </p>
        </>
      )}
    </section>
  );
}
