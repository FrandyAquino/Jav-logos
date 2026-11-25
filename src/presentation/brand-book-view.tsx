import { useState } from "react";
import { BookOpen, Download } from "lucide-react";
import { TextField } from "./property-fields";
import { ConceptArtwork } from "./concept-artwork";
import type { StudioState } from "./ui";
import { SelectField } from "./select-field";
export function BrandBookView({ studio }: { studio: StudioState }) {
  const [mode, setMode] = useState<"composition" | "original">("composition");
  const brand = studio.selectedBrand;
  if (!brand)
    return (
      <div className="inspector-empty">
        <BookOpen />
        <h2>Select a brand</h2>
        <p>
          Your identity book uses its approved logo, DNA and written guidelines.
        </p>
      </div>
    );
  const concept = studio.selectedConcept;
  const copy = brand.book ?? {};
  return (
    <section className="brand-book-view" aria-label="Brand book">
      <div className="view-intro">
        <div>
          <h2>Brand book</h2>
          <p>
            Edit the story and usage notes, then export a self-contained
            presentation.
          </p>
        </div>
        <button
          className="primary-button"
          disabled={!concept || studio.busy}
          onClick={() => void studio.exportBrandBook(mode)}
        >
          <Download size={15} />
          Export brand book
        </button>
      </div>
      <div className="book-grid">
        <div className="book-copy">
          <label>Cover headline</label>
          <TextField
            label="Book headline"
            value={copy.headline ?? brand.name}
            maxLength={200}
            onCommit={(headline) => studio.updateBrandBook({ headline })}
          />
          <label>Brand overview</label>
          <TextField
            label="Book overview"
            value={copy.overview ?? ""}
            maxLength={3000}
            multiline
            onCommit={(overview) => studio.updateBrandBook({ overview })}
          />
          <label>Voice and personality</label>
          <TextField
            label="Book voice"
            value={copy.voice ?? studio.resolvedDna.tone}
            maxLength={1500}
            multiline
            onCommit={(voice) => studio.updateBrandBook({ voice })}
          />
          <label>Usage guidelines</label>
          <TextField
            label="Book usage notes"
            value={copy.usageNotes ?? ""}
            maxLength={3000}
            multiline
            onCommit={(usageNotes) => studio.updateBrandBook({ usageNotes })}
          />
          <SelectField
            label="Book artwork"
            value={mode}
            onValueChange={(value) => setMode(value as typeof mode)}
            options={[
              { value: "composition", label: "Editable composition" },
              ...(concept?.raster
                ? [{ value: "original", label: "Original image" }]
                : []),
            ]}
          />
          <p className="field-help">
            Exports local HTML with embedded artwork and print layout. Open it
            in a browser to print or save a PDF.
          </p>
        </div>
        <div className="book-cover">
          <span>Visual identity</span>
          <h2>{copy.headline || brand.name}</h2>
          {concept ? (
            <ConceptArtwork
              concept={concept}
              mode={mode === "original" ? "image" : "vector"}
              alt="Brand book cover logo"
            />
          ) : (
            <p>Select a concept for the cover.</p>
          )}
          <p>{copy.overview || "Your brand story goes here."}</p>
          <div className="book-palette">
            {studio.resolvedDna.palette.map((color) => (
              <span key={color} style={{ background: color }} title={color} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
