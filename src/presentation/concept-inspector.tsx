import { useState } from "react";
import {
  Check,
  ChevronDown,
  Dna,
  Download,
  History,
  Save,
  ScanLine,
  SlidersHorizontal,
} from "lucide-react";
import { analyzeConsistency } from "../domain/brand-dna";
import type { ShapeKind } from "../domain/types";
import { Field, shapes, type StudioState } from "./ui";
import { ColorField, TextField, RangeField } from "./property-fields";
import { FontPicker } from "./font-picker";
import { SelectField } from "./select-field";
import { CompositionControls } from "./composition-controls";
export function ConceptInspector({ studio }: { studio: StudioState }) {
  const concept = studio.selectedConcept;
  const [versionsOpen, setVersionsOpen] = useState(false);
  if (!concept)
    return (
      <div className="inspector-empty">
        <SlidersHorizontal size={25} />
        <h3>Make it your own</h3>
        <p>Generate or select a concept to edit its composition.</p>
      </div>
    );
  const document = concept.document;
  const consistency = analyzeConsistency(
    concept.brandId,
    studio.workspace.brands,
    document,
  );
  return (
    <>
      <div className="inspector-section">
        <div className="section-heading">
          <h3>Editable composition</h3>
          <span className="tiny-tag">SVG</span>
        </div>
        {concept.raster && (
          <p className="field-help">
            Edit the composition below. Original artwork remains available for
            comparison.
          </p>
        )}
        <Field label="Symbol">
          <SelectField
            label="Logo symbol"
            value={document.shape}
            onValueChange={(shape) =>
              studio.updateConcept({
                shape: shape as ShapeKind,
                symbolSource: "geometric",
              })
            }
            options={shapes.map((shape) => ({
              value: shape,
              label: shape[0].toUpperCase() + shape.slice(1),
            }))}
          />
        </Field>
        <Field label="Wordmark">
          <TextField
            label="Logo wordmark"
            value={document.text}
            maxLength={120}
            onCommit={(text) => studio.updateConcept({ text })}
          />
        </Field>
        <Field label="Typeface">
          <FontPicker
            label="Logo typeface"
            value={document.fontFamily}
            onValueChange={(fontFamily) => studio.updateConcept({ fontFamily })}
          />
        </Field>
        <ColorField
          label="Logo"
          value={document.primary}
          onChange={(primary) => studio.updateConcept({ primary })}
        />
        <ColorField
          label="Background"
          value={document.background}
          onChange={(background) => studio.updateConcept({ background })}
        />
      </div>
      <CompositionControls studio={studio} />
      <div className="inspector-section">
        <h3>Transform</h3>
        <Field
          label="Scale"
          hint={<output>{Math.round(document.scale * 100)}%</output>}
        >
          <RangeField
            label="Symbol scale"
            min={0.3}
            max={2}
            step={0.05}
            value={document.scale}
            onCommit={(scale) => studio.updateConcept({ scale })}
          />
        </Field>
        <Field label="Rotation" hint={<output>{document.rotation}°</output>}>
          <RangeField
            label="Symbol rotation"
            min={-180}
            max={180}
            step={1}
            value={document.rotation}
            onCommit={(rotation) => studio.updateConcept({ rotation })}
          />
        </Field>
        <div className="field-pair">
          <Field label="Tracking">
            <input
              aria-label="Wordmark tracking"
              type="number"
              min="-5"
              max="30"
              step="0.5"
              value={document.letterSpacing}
              onChange={(event) => {
                if (Number.isFinite(event.target.valueAsNumber))
                  studio.updateConcept({
                    letterSpacing: event.target.valueAsNumber,
                  });
              }}
            />
          </Field>
          <Field label="Stroke">
            <input
              aria-label="Symbol stroke width"
              type="number"
              min="0"
              max="12"
              value={document.strokeWidth}
              onChange={(event) => {
                if (Number.isFinite(event.target.valueAsNumber))
                  studio.updateConcept({
                    strokeWidth: event.target.valueAsNumber,
                  });
              }}
            />
          </Field>
        </div>
      </div>
      <div className="inspector-section">
        <div className="consistency-heading">
          <Dna size={15} />
          <strong>Brand consistency</strong>
          <span>{consistency.score}%</span>
        </div>
        <div className="consistency-track">
          <span style={{ width: `${consistency.score}%` }} />
        </div>
        {consistency.issues.length ? (
          <ul className="consistency-issues">
            {consistency.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : (
          <p className="consistency-good">
            <Check size={12} /> Aligned with this brand’s DNA
          </p>
        )}
      </div>
      <div className="inspector-section">
        <button
          type="button"
          className="section-disclosure"
          onClick={() => setVersionsOpen(!versionsOpen)}
          aria-expanded={versionsOpen}
        >
          <History size={14} />
          <strong>Composition versions</strong>
          <span>{concept.versions.length}</span>
          <ChevronDown size={13} />
        </button>
        <button
          type="button"
          className="outline-button full-width"
          onClick={() => void studio.saveVersion()}
          disabled={studio.busy}
        >
          <Save size={13} /> Save current version
        </button>
        {versionsOpen && (
          <div className="version-list">
            {concept.versions.length ? (
              [...concept.versions].reverse().map((version, index) => (
                <div className="version-row" key={version.id}>
                  <span>
                    <strong>Version {concept.versions.length - index}</strong>
                    <small>
                      {new Date(version.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                  </span>
                  <button
                    type="button"
                    onClick={() => void studio.restoreVersion(version.id)}
                    disabled={studio.busy}
                  >
                    Restore
                  </button>
                </div>
              ))
            ) : (
              <p className="field-help">
                Save a version before trying a new direction.
              </p>
            )}
          </div>
        )}
      </div>
      <div className="inspector-section">
        <h3>Export & finish</h3>
        {concept.raster && (
          <button
            type="button"
            className="outline-button full-width"
            onClick={() => void studio.vectorizeConcept()}
            disabled={studio.busy}
          >
            <ScanLine size={14} />
            {concept.tracedSvg ? "Trace image again" : "Trace image to SVG"}
          </button>
        )}
        <div className="export-row">
          <button
            type="button"
            className="outline-button"
            onClick={() => void studio.exportSvg("composition")}
            disabled={studio.busy}
          >
            <Download size={13} /> Composition SVG
          </button>
          <button
            type="button"
            className="outline-button"
            onClick={() => void studio.exportPng("composition")}
            disabled={studio.busy}
          >
            <Download size={13} /> PNG
          </button>
        </div>
        {concept.tracedSvg && (
          <button
            type="button"
            className="outline-button full-width"
            onClick={() => void studio.exportSvg("trace")}
            disabled={studio.busy}
          >
            <Download size={13} /> Export traced SVG
          </button>
        )}
        <button
          type="button"
          className="outline-button full-width"
          onClick={() => void studio.exportKit()}
          disabled={studio.busy}
        >
          <Download size={13} /> Export brand kit
        </button>
        <p className="field-help">
          Includes visual assets, brand rules, and generation provenance.
        </p>
      </div>
    </>
  );
}
