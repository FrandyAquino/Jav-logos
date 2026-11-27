import { useEffect, useRef, useState } from "react";
import type { Concept } from "../domain/types";
import {
  compositionColors,
  REFINEMENT_PRESETS,
  type CompositionChanges,
} from "../domain/refinement";
import { previewCompositionRefinement } from "../infrastructure/refinement-preview";
import { ConceptArtwork } from "./concept-artwork";
import { ColorField } from "./property-fields";
import { FontPicker } from "./font-picker";
import { SelectField } from "./select-field";
import { GenerationProgressPanel } from "./generation-progress";
import type { StudioState } from "./ui";

export function RefinementEditor({
  concept,
  studio,
  mode,
  surround,
}: {
  concept: Concept;
  studio: StudioState;
  mode: "composition" | "ai";
  surround: string;
}) {
  const [colors, setColors] = useState<Record<string, string>>({});
  const [background, setBackground] = useState<string>();
  const [fontFamily, setFontFamily] = useState<string>();
  const [tint, setTint] = useState(false);
  const [tintColor, setTintColor] = useState(concept.document.primary);
  const [instruction, setInstruction] = useState("");
  const [count, setCount] = useState("1");
  const [preview, setPreview] = useState<{
    key: string;
    concept?: Concept;
    error?: string;
  }>();
  const [actionError, setActionError] = useState("");
  const lock = useRef(false);
  const changes: CompositionChanges = {
    colors,
    ...(background &&
    background.toLowerCase() !== concept.document.background.toLowerCase()
      ? { background }
      : {}),
    ...(fontFamily && fontFamily !== concept.document.fontFamily
      ? { fontFamily }
      : {}),
    ...(tint ? { symbolTint: tintColor } : {}),
  };
  const key = JSON.stringify(changes);
  const dirty =
    Object.entries(colors).some(([from, to]) => from !== to.toLowerCase()) ||
    Boolean(changes.background || changes.fontFamily || changes.symbolTint);
  useEffect(() => {
    let current = true;
    const captured = JSON.parse(key) as CompositionChanges;
    if (dirty)
      void previewCompositionRefinement(concept, captured)
        .then((result) => {
          if (current) setPreview({ key, concept: result });
        })
        .catch((error) => {
          if (current)
            setPreview({
              key,
              error: error instanceof Error ? error.message : String(error),
            });
        });
    return () => {
      current = false;
    };
  }, [concept, key, dirty]);
  const ready = !dirty || (preview?.key === key && Boolean(preview.concept));
  const disabled =
    studio.busy ||
    studio.selectedBrand?.status === "archived" ||
    studio.pendingConcepts.length > 0;
  const currentPreview = mode === "composition" && dirty;
  const after = currentPreview
    ? preview?.key === key
      ? preview.concept
      : undefined
    : concept;
  const source = concept.document.symbolSource ?? "geometric";
  return (
    <>
      {studio.generationProgress &&
        studio.generationBrandId === concept.brandId && (
          <GenerationProgressPanel studio={studio} compact />
        )}
      <div className="refinement-pair">
        <figure>
          <div className={`refinement-art ${surround}`}>
            {!currentPreview && concept.refinement ? (
              <img
                src={concept.refinement.before}
                alt="Before refinement snapshot"
              />
            ) : (
              <ConceptArtwork
                concept={concept}
                mode="vector"
                alt="Before refinement composition"
              />
            )}
          </div>
          <figcaption>
            {!currentPreview && concept.refinement
              ? "Before · saved snapshot"
              : "Current composition"}
          </figcaption>
        </figure>
        <figure>
          <div className={`refinement-art ${surround}`}>
            {after ? (
              <ConceptArtwork
                concept={after}
                mode="vector"
                alt="After refinement composition"
              />
            ) : (
              <p role="status">Preparing preview…</p>
            )}
          </div>
          <figcaption>
            {currentPreview
              ? "Preview · not saved"
              : concept.refinement
                ? "After · saved concept"
                : "Choose a change below"}
          </figcaption>
        </figure>
      </div>
      {mode === "composition" ? (
        <div className="refinement-edit-panel">
          <h3>Exact composition changes</h3>
          <fieldset disabled={disabled} className="refinement-fields">
            <legend className="visually-hidden">Refinement properties</legend>
            <div className="refinement-colors">
              {compositionColors(concept).map((color, index) => (
                <ColorField
                  key={color}
                  label={
                    index === 0
                      ? source === "image" || source === "trace"
                        ? "Refinement text"
                        : "Refinement primary"
                      : `Refinement path ${index}`
                  }
                  value={colors[color] ?? color}
                  onChange={(value) => {
                    setColors((old) => ({ ...old, [color]: value }));
                    setActionError("");
                  }}
                />
              ))}
              <ColorField
                label="Refinement background"
                value={background ?? concept.document.background}
                onChange={setBackground}
              />
            </div>
            <FontPicker
              label="Refinement typeface"
              value={fontFamily ?? concept.document.fontFamily}
              disabled={disabled}
              onValueChange={setFontFamily}
            />
            {source === "image" && concept.cutout && (
              <>
                <label className="refinement-check">
                  <input
                    type="checkbox"
                    checked={tint}
                    onChange={(event) => setTint(event.target.checked)}
                  />
                  Tint the saved transparent symbol
                </label>
                {tint && (
                  <ColorField
                    label="Refinement symbol tint"
                    value={tintColor}
                    onChange={setTintColor}
                  />
                )}
              </>
            )}
          </fieldset>
          {(source === "image" || source === "trace") && (
            <p className="field-help">
              Palette and typeface controls change editable text, not pixels
              inside the original image or trace. Use a saved cutout tint,
              editable paths or AI for symbol colors.
            </p>
          )}
          <div className="refinement-actions">
            <button
              type="button"
              className="subtle-button"
              disabled={disabled || !dirty}
              onClick={() => {
                setColors({});
                setBackground(undefined);
                setFontFamily(undefined);
                setTint(false);
                setActionError("");
              }}
            >
              Reset preview
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={disabled || !dirty || !ready}
              onClick={async () => {
                if (lock.current) return;
                lock.current = true;
                setActionError("");
                try {
                  if (!(await studio.refineComposition(concept.id, changes)))
                    setActionError(
                      "Could not save this refinement. Resolve the workspace error and retry; the original is unchanged.",
                    );
                } finally {
                  lock.current = false;
                }
              }}
            >
              Save refined copy
            </button>
          </div>
          {preview?.key === key && preview.error && (
            <p role="alert" className="dialog-error">
              {preview.error}
            </p>
          )}
        </div>
      ) : (
        <div className="refinement-edit-panel">
          <h3>Reinterpret the symbol</h3>
          <p className="field-help">
            The symbol shown in the editable composition is the reference. The
            name, slogan and layout stay editable. AI preservation requests are
            guidance, not exact locks.
          </p>
          <div
            className="refinement-presets"
            role="group"
            aria-label="Refinement directions"
          >
            {REFINEMENT_PRESETS.map((preset) => (
              <button
                type="button"
                key={preset.id}
                className="outline-button"
                disabled={disabled}
                onClick={() => setInstruction(preset.instruction)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <label className="refinement-instruction">
            What should change?
            <textarea
              aria-label="Refinement instruction"
              value={instruction}
              maxLength={1500}
              rows={4}
              disabled={disabled}
              placeholder="Simplify the inner details, keeping the recognizable silhouette…"
              onChange={(event) => setInstruction(event.target.value)}
            />
          </label>
          <div className="refinement-actions">
            <SelectField
              label="Refinement variations"
              value={count}
              disabled={disabled}
              onValueChange={setCount}
              options={[1, 2, 3, 4].map((number) => ({
                value: String(number),
                label: `${number} ${number === 1 ? "variation" : "variations"}`,
              }))}
            />
            <button
              type="button"
              className="primary-button"
              disabled={
                disabled ||
                !instruction.trim() ||
                !studio.providerHealth.available ||
                concept.document.showSymbol === false
              }
              onClick={async () => {
                if (lock.current) return;
                lock.current = true;
                setActionError("");
                try {
                  const sent = instruction;
                  if (
                    await studio.refineWithAi(concept.id, sent, Number(count))
                  )
                    setInstruction((current) =>
                      current === sent ? "" : current,
                    );
                } finally {
                  lock.current = false;
                }
              }}
            >
              Generate refined symbol
            </button>
          </div>
          {!studio.providerHealth.available && (
            <p className="field-help">
              Local AI is unavailable. Open Local AI setup to check the runtime.
            </p>
          )}
          {concept.document.showSymbol === false && (
            <p className="field-help">
              Enable the symbol layer in Design before refining it with AI.
            </p>
          )}
          {concept.refinement?.kind === "ai" && (
            <button
              type="button"
              className="subtle-button"
              disabled={disabled}
              onClick={() => setInstruction(concept.refinement!.instruction)}
            >
              Reuse refinement instruction
            </button>
          )}
        </div>
      )}
      {studio.error && (
        <p role="alert" className="dialog-error">
          {studio.error}
        </p>
      )}
      {actionError && (
        <p role="alert" className="dialog-error">
          {actionError}
        </p>
      )}
      {studio.selectedBrand?.status === "archived" && (
        <p className="field-help">
          Restore this brand before creating refinements.
        </p>
      )}
      {concept.refinement && (
        <details className="refinement-request">
          <summary>Saved refinement request</summary>
          <p>{concept.refinement.instruction}</p>
          <small>
            {concept.refinement.kind === "ai"
              ? "Local AI reinterpretation"
              : "Deterministic composition edit"}
          </small>
        </details>
      )}
    </>
  );
}
