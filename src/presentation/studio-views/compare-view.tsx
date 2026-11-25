import { useState } from "react";
import { Star, Check } from "lucide-react";
import type { Concept } from "../../domain/types";
import { ConceptArtwork } from "../concept-artwork";
import { TextField } from "../property-fields";
import { SelectField } from "../select-field";
import type { StudioState } from "../ui";
import {
  ArtworkModeSelect,
  artworkLabel,
  supportsMonochrome,
  ViewEmpty,
  ViewHeading,
  type ArtworkMode,
} from "./view-primitives";

export function CompareView({ studio }: { studio: StudioState }) {
  const brandId = studio.selectedBrand?.id;
  const concepts = studio.workspace.concepts.filter(
    (c) => c.brandId === brandId,
  );
  const [choice, setChoice] = useState<{
    brandId: string | undefined;
    ids: string[];
  }>({ brandId: undefined, ids: [] });
  const [mode, setMode] = useState<ArtworkMode>("vector");
  const [surround, setSurround] = useState("paper");
  const [mono, setMono] = useState(false);
  const [scale, setScale] = useState("100");
  const ids =
    choice.brandId === brandId
      ? choice.ids.filter((id) => concepts.some((c) => c.id === id))
      : concepts.slice(0, 4).map((c) => c.id);
  const chosen = concepts.filter((c) => ids.includes(c.id));
  const toggle = (id: string) =>
    setChoice({
      brandId,
      ids: ids.includes(id)
        ? ids.filter((value) => value !== id)
        : [...ids, id].slice(0, 4),
    });
  const preview = (concept: Concept): Concept =>
    mode === "vector"
      ? {
          ...concept,
          document: {
            ...concept.document,
            background: surround === "dark" ? "#172538" : "#ffffff",
            ...(mono && supportsMonochrome(concept)
              ? {
                  monochrome: true,
                  primary: surround === "dark" ? "#ffffff" : "#172538",
                }
              : {}),
          },
        }
      : concept;
  return (
    <section
      className="exploration-view compare-view"
      aria-label="Concept comparison"
    >
      <ViewHeading
        title="Compare directions"
        description="Evaluate up to four concepts at the same scale and surround. Your original designs stay unchanged."
      />
      {!brandId ? (
        <ViewEmpty title="Choose a brand">
          Select a brand to compare its concepts.
        </ViewEmpty>
      ) : concepts.length < 2 ? (
        <ViewEmpty title="Give yourself a second direction">
          Generate at least two concepts for this brand to compare them.
        </ViewEmpty>
      ) : (
        <>
          <div className="exploration-toolbar">
            <ArtworkModeSelect value={mode} onChange={setMode} />
            <SelectField
              label="Comparison surround"
              value={surround}
              onValueChange={setSurround}
              options={[
                { value: "paper", label: "Paper surround" },
                { value: "dark", label: "Dark surround" },
              ]}
            />
            <SelectField
              label="Comparison scale"
              value={scale}
              onValueChange={setScale}
              options={[
                { value: "75", label: "75% scale" },
                { value: "100", label: "100% scale" },
                { value: "125", label: "125% scale" },
              ]}
            />
            <label className="exploration-check">
              <input
                type="checkbox"
                checked={mono}
                disabled={mode !== "vector"}
                onChange={(event) => setMono(event.target.checked)}
              />
              Monochrome inspection
            </label>
          </div>
          <fieldset className="comparison-picks">
            <legend>Choose two to four concepts</legend>
            {concepts.map((concept, index) => (
              <label
                key={concept.id}
                className={ids.includes(concept.id) ? "selected" : ""}
              >
                <input
                  type="checkbox"
                  checked={ids.includes(concept.id)}
                  disabled={
                    ids.includes(concept.id) ? ids.length <= 2 : ids.length >= 4
                  }
                  onChange={() => toggle(concept.id)}
                />
                <span>{concept.name}</span>
                <small>{index + 1}</small>
              </label>
            ))}
          </fieldset>
          <div className="comparison-grid" data-count={chosen.length}>
            {chosen.map((concept, index) => (
              <article className="comparison-card" key={concept.id}>
                <div className="comparison-card-heading">
                  <h3>{concept.name}</h3>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Favorite comparison ${index + 1}`}
                    aria-pressed={Boolean(concept.favorite)}
                    onClick={() =>
                      void studio.updateConceptMetadata(concept.id, {
                        favorite: !concept.favorite,
                      })
                    }
                  >
                    <Star
                      size={17}
                      fill={concept.favorite ? "currentColor" : "none"}
                    />
                  </button>
                </div>
                <div className={`comparison-art ${surround}`}>
                  <div style={{ width: `${scale}%`, height: `${scale}%` }}>
                    <ConceptArtwork
                      concept={preview(concept)}
                      mode={mode}
                      alt={`${concept.name} comparison`}
                    />
                  </div>
                </div>
                <div className="comparison-caption">
                  <span>{artworkLabel(concept, mode)}</span>
                  {studio.selectedConcept?.id === concept.id && (
                    <span>
                      <Check size={12} />
                      Selected
                    </span>
                  )}
                </div>
                {mono && mode === "vector" && !supportsMonochrome(concept) && (
                  <p className="exploration-note">
                    Image-based symbols preserve their colors. Convert to
                    editable paths for monochrome inspection.
                  </p>
                )}
                <div
                  className="comparison-small-sizes"
                  aria-label={`${concept.name} small-size previews`}
                >
                  {[16, 32, 64].map((size) => (
                    <div key={size}>
                      <div style={{ width: size, height: size }}>
                        <ConceptArtwork
                          concept={preview(concept)}
                          mode={mode}
                          alt={`${concept.name} at ${size} pixels`}
                        />
                      </div>
                      <span>{size}px</span>
                    </div>
                  ))}
                </div>
                <span className="comparison-note-label">Review notes</span>
                <TextField
                  label={`Notes for comparison ${index + 1}`}
                  value={concept.notes ?? ""}
                  multiline
                  maxLength={1000}
                  onCommit={(notes) =>
                    studio.updateConceptMetadata(concept.id, { notes })
                  }
                />
                <button
                  type="button"
                  className="subtle-button full-width"
                  onClick={() => studio.selectConcept(concept.id)}
                >
                  Select for editing
                </button>
              </article>
            ))}
          </div>
          <p className="exploration-note">
            Small-size previews are shown at actual CSS pixel sizes. Image
            backgrounds are preserved. These are visual checks, not an automatic
            quality certification.
          </p>
        </>
      )}
    </section>
  );
}
