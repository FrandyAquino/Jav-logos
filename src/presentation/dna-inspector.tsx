import { Dna, Link2, RotateCcw } from "lucide-react";
import type { BrandDna, ShapeKind } from "../domain/types";
import { Field, fonts, shapes, type StudioState } from "./ui";
import { ColorField, TextField } from "./property-fields";
export function DnaInspector({ studio }: { studio: StudioState }) {
  const brand = studio.selectedBrand;
  if (!brand)
    return (
      <div className="inspector-empty">
        <Dna size={25} />
        <h3>Your brand’s foundations</h3>
        <p>Select or create a brand to shape its visual identity.</p>
      </div>
    );
  const dna = studio.resolvedDna;
  const parent = studio.workspace.brands.find(
    (candidate) => candidate.id === brand.parentId,
  );
  const source = (key: keyof BrandDna) =>
    parent ? (
      <span className="inheritance-control">
        {brand.dna[key] === undefined ? (
          <span>
            <Link2 size={10} /> Inherited
          </span>
        ) : (
          <button
            type="button"
            onClick={() => studio.resetDna(key)}
            title={`Inherit ${key} from ${parent.name}`}
          >
            <RotateCcw size={10} /> Reset
          </button>
        )}
      </span>
    ) : undefined;
  return (
    <>
      <div className="inspector-section">
        <Field label="Brand name">
          <TextField
            label="Brand name"
            value={brand.name}
            maxLength={120}
            onCommit={studio.updateBrandName}
          />
        </Field>
        {parent && (
          <div className="inheritance-note">
            <Link2 size={13} />
            <span>
              Inheriting from <strong>{parent.name}</strong>
            </span>
          </div>
        )}
      </div>
      <div className="inspector-section">
        <div className="section-heading">
          <h3>Color palette</h3>
          {source("palette")}
        </div>
        <div className="palette-ribbon">
          {dna.palette.map((color, index) => (
            <span key={index} style={{ background: color }} />
          ))}
        </div>
        <div className="color-fields">
          {dna.palette.map((color, index) => (
            <ColorField
              key={index}
              label={
                index === 0
                  ? "Primary"
                  : index === 1
                    ? "Secondary"
                    : `Accent ${index - 1}`
              }
              value={color}
              onChange={(value) =>
                studio.updateDna({
                  palette: dna.palette.map((entry, position) =>
                    position === index ? value : entry,
                  ),
                })
              }
            />
          ))}
        </div>
      </div>
      <div className="inspector-section">
        <Field label="Typography" hint={source("typography")}>
          <select
            aria-label="Brand typography"
            value={dna.typography}
            onChange={(event) =>
              studio.updateDna({ typography: event.target.value })
            }
          >
            {fonts.map((font) => (
              <option key={font}>{font}</option>
            ))}
          </select>
        </Field>
        <div className="type-specimen" style={{ fontFamily: dna.typography }}>
          <span>Aa</span>
          <p>
            {dna.typography}
            <small>
              ABCDEFGHIJKLMNOPQRSTUVWXYZ
              <br />
              abcdefghijklmnopqrstuvwxyz
            </small>
          </p>
        </div>
      </div>
      <div className="inspector-section">
        <Field label="Signature geometry" hint={source("geometry")}>
          <select
            aria-label="Brand geometry"
            value={dna.geometry}
            onChange={(event) =>
              studio.updateDna({ geometry: event.target.value as ShapeKind })
            }
          >
            {shapes.map((shape) => (
              <option key={shape} value={shape}>
                {shape[0].toUpperCase() + shape.slice(1)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Brand personality" hint={source("tone")}>
          <TextField
            label="Brand personality"
            value={dna.tone}
            maxLength={500}
            multiline
            onCommit={(tone) => studio.updateDna({ tone })}
          />
        </Field>
        <p className="field-help">
          These rules guide new concepts. Existing designs keep their own
          composition.
        </p>
      </div>
    </>
  );
}
