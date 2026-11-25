import { useEffect, useRef, useState } from "react";
import { Layers3, Redo2, Undo2 } from "lucide-react";
import type { VectorDocument } from "../domain/types";
import { assessDesign } from "../domain/design-quality";
import { Field, type StudioState } from "./ui";
import { TextField } from "./property-fields";
import { SelectField } from "./select-field";
import "./editor.css";

export function NumberControl({
  label,
  value,
  min,
  max,
  step = 1,
  disabled = false,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onCommit: (value: number) => unknown;
}) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);
  const cancelled = useRef(false);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);
  const commit = () => {
    focused.current = false;
    if (cancelled.current) {
      cancelled.current = false;
      setDraft(String(value));
      setInvalid(false);
      return;
    }
    const number = Number(draft);
    if (
      draft.trim() === "" ||
      !Number.isFinite(number) ||
      number < min ||
      number > max
    ) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (number !== value) void onCommit(number);
  };
  return (
    <label className="editor-number-field">
      <span>{label}</span>
      <input
        aria-label={label}
        type="number"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        value={draft}
        onFocus={() => {
          focused.current = true;
        }}
        onChange={(event) => {
          setDraft(event.target.value);
          setInvalid(false);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            cancelled.current = true;
            setDraft(String(value));
            setInvalid(false);
            event.currentTarget.blur();
          }
        }}
      />
      {invalid && (
        <small>
          Use a value from {min} to {max}.
        </small>
      )}
    </label>
  );
}

export function CompositionControls({ studio }: { studio: StudioState }) {
  const concept = studio.selectedConcept;
  if (!concept) return null;
  const doc = concept.document;
  const source = doc.symbolSource ?? "geometric";
  const vectorSource = source === "geometric" || source === "custom";
  const layers: [
    keyof Pick<VectorDocument, "showSymbol" | "showWordmark" | "showSlogan">,
    string,
  ][] = [
    ["showSymbol", "Symbol layer"],
    ["showWordmark", "Wordmark layer"],
    ["showSlogan", "Slogan layer"],
  ];
  const sources = [
    {
      value: "geometric",
      label: "Geometric symbol",
      description: "Editable primitive geometry",
    },
    ...(concept.raster
      ? [
          {
            value: "image",
            label: "Generated image",
            description: "Original raster mark",
          },
        ]
      : []),
    ...(concept.tracedSvg
      ? [
          {
            value: "trace",
            label: "Traced symbol",
            description: "Preserved SVG image",
          },
        ]
      : []),
    ...(doc.paths?.length
      ? [
          {
            value: "custom",
            label: "Editable paths",
            description: "Anchors and curve handles",
          },
        ]
      : []),
  ];
  return (
    <>
      <section
        className="inspector-section composition-controls"
        aria-label="Logo composition"
      >
        <div className="section-heading">
          <h3>
            <Layers3 size={14} /> Logo pieces
          </h3>
          <div className="editor-history-controls">
            <button
              type="button"
              className="icon-button"
              aria-label="Undo composition edit"
              title="Undo composition edit"
              disabled={!studio.canUndo || studio.busy}
              onClick={() => void studio.undoConcept()}
            >
              <Undo2 size={15} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Redo composition edit"
              title="Redo composition edit"
              disabled={!studio.canRedo || studio.busy}
              onClick={() => void studio.redoConcept()}
            >
              <Redo2 size={15} />
            </button>
          </div>
        </div>
        <Field label="Arrangement">
          <SelectField
            label="Logo arrangement"
            value={doc.layout ?? "stacked"}
            disabled={studio.busy}
            onValueChange={(layout) =>
              void studio.updateConcept({
                layout: layout as VectorDocument["layout"],
              })
            }
            options={[
              { value: "stacked", label: "Stacked" },
              { value: "horizontal", label: "Horizontal" },
              { value: "symbol", label: "Symbol only" },
              { value: "wordmark", label: "Wordmark only" },
            ]}
          />
        </Field>
        <Field label="Symbol source">
          <SelectField
            label="Symbol source"
            value={source}
            disabled={studio.busy}
            onValueChange={(value) =>
              void studio.updateConcept({
                symbolSource: value as VectorDocument["symbolSource"],
                ...(["image", "trace"].includes(value)
                  ? {
                      monochrome: false,
                      ...(doc.motion === "draw"
                        ? { motion: "none" as const }
                        : {}),
                    }
                  : {}),
              })
            }
            options={sources}
          />
        </Field>
        <Field label="Slogan">
          <TextField
            label="Logo slogan"
            value={doc.slogan ?? ""}
            maxLength={160}
            onCommit={(slogan) => studio.updateConcept({ slogan })}
          />
        </Field>
        <div className="composition-layer-list">
          {layers.map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={doc[key] !== false}
                disabled={studio.busy}
                onChange={(event) =>
                  void studio.updateConcept({ [key]: event.target.checked })
                }
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <label className="composition-mono">
          <input
            type="checkbox"
            checked={doc.monochrome ?? false}
            disabled={!vectorSource || studio.busy}
            onChange={(event) =>
              void studio.updateConcept({ monochrome: event.target.checked })
            }
          />
          <span>Monochrome vector mark</span>
        </label>
        {!vectorSource && (
          <p className="field-help">
            Image and traced sources preserve their original colors. Convert a
            trace to editable paths to recolor it.
          </p>
        )}
        <div className="editor-number-grid">
          <NumberControl
            label="Wordmark size"
            value={doc.wordmarkSize ?? 38}
            min={12}
            max={96}
            disabled={studio.busy}
            onCommit={(wordmarkSize) => studio.updateConcept({ wordmarkSize })}
          />
          <NumberControl
            label="Slogan size"
            value={doc.sloganSize ?? 18}
            min={10}
            max={40}
            disabled={studio.busy}
            onCommit={(sloganSize) => studio.updateConcept({ sloganSize })}
          />
        </div>
        <details className="composition-positions">
          <summary>Position each piece</summary>
          {(["symbol", "wordmark", "slogan"] as const).map((layer) => (
            <div className="editor-number-grid" key={layer}>
              <NumberControl
                label={`${layer[0].toUpperCase() + layer.slice(1)} X offset`}
                value={doc[`${layer}OffsetX`] ?? 0}
                min={-320}
                max={320}
                disabled={studio.busy}
                onCommit={(value) =>
                  studio.updateConcept({ [`${layer}OffsetX`]: value })
                }
              />
              <NumberControl
                label={`${layer[0].toUpperCase() + layer.slice(1)} Y offset`}
                value={doc[`${layer}OffsetY`] ?? 0}
                min={-320}
                max={320}
                disabled={studio.busy}
                onCommit={(value) =>
                  studio.updateConcept({ [`${layer}OffsetY`]: value })
                }
              />
            </div>
          ))}
        </details>
        <p className="field-help">
          These controls change the editable composition. Original AI artwork is
          kept separately.
        </p>
      </section>
      <DesignQuality document={doc} />
    </>
  );
}

export function DesignQuality({ document }: { document: VectorDocument }) {
  const quality = assessDesign(document);
  return (
    <section
      className="inspector-section design-quality"
      aria-label="Design quality checks"
    >
      <div className="section-heading">
        <h3>Design checks</h3>
        <span className="quality-ratio">{quality.contrast.toFixed(2)}:1</span>
      </div>
      <p className="field-help">
        Composition color contrast against its background. These checks do not
        inspect raster pixels or certify a trademark.
      </p>
      {quality.issues.length ? (
        <ul>
          {quality.issues.map((issue) => (
            <li key={issue.code} className={issue.severity}>
              {issue.message}
            </li>
          ))}
        </ul>
      ) : (
        <p className="consistency-good">
          No issues found by the current composition checks.
        </p>
      )}
    </section>
  );
}
