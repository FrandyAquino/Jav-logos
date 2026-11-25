import { useState } from "react";
import {
  CreditCard,
  Package,
  AppWindow,
  Smartphone,
  Store,
} from "lucide-react";
import type { Brand, Concept } from "../../domain/types";
import { ConceptArtwork } from "../concept-artwork";
import type { StudioState } from "../ui";
import {
  ArtworkModeSelect,
  ViewEmpty,
  ViewHeading,
  type ArtworkMode,
} from "./view-primitives";
export type MockupTemplate = "card" | "package" | "web" | "app" | "sign";
const templates = [
  { id: "card" as const, label: "Business card", Icon: CreditCard },
  { id: "package" as const, label: "Packaging", Icon: Package },
  { id: "web" as const, label: "Web header", Icon: AppWindow },
  { id: "app" as const, label: "App icon", Icon: Smartphone },
  { id: "sign" as const, label: "Signage", Icon: Store },
];
export function MockupScene({
  concept,
  brand,
  mode,
  template,
}: {
  concept: Concept;
  brand: Brand;
  mode: ArtworkMode;
  template: MockupTemplate;
}) {
  const artwork = (
    <ConceptArtwork
      concept={concept}
      mode={mode}
      alt={`${brand.name} ${template} application`}
    />
  );
  return (
    <div
      className={`mockup-scene mockup-${template}`}
      aria-label={`${templates.find((item) => item.id === template)?.label} template preview`}
    >
      {template === "card" && (
        <div className="mockup-card-object">
          <div className="mockup-card-logo">{artwork}</div>
          <div className="mockup-card-footer">
            <strong>{brand.name}</strong>
            <span>Brand identity</span>
          </div>
        </div>
      )}
      {template === "package" && (
        <div className="mockup-package-object">
          <div className="mockup-package-top" />
          <div className="mockup-package-label">{artwork}</div>
          <div className="mockup-package-caption">
            <strong>{brand.name}</strong>
            <span>Packaging application</span>
          </div>
        </div>
      )}
      {template === "web" && (
        <div className="mockup-browser-object">
          <div className="mockup-browser-bar">
            <span />
            <span />
            <span />
            <div>Website preview</div>
          </div>
          <div className="mockup-web-nav">
            <div>{artwork}</div>
            <span>{brand.name}</span>
          </div>
          <div className="mockup-web-body">
            <h3>{brand.book?.headline || brand.name}</h3>
            <p>
              {brand.book?.overview ||
                "A preview of the identity on a website."}
            </p>
            <div className="mockup-web-feature">{artwork}</div>
          </div>
        </div>
      )}
      {template === "app" && (
        <div className="mockup-phone-object">
          <div className="mockup-phone-camera" />
          <div className="mockup-app-art">{artwork}</div>
          <strong>{brand.name}</strong>
          <span>Application icon preview</span>
        </div>
      )}
      {template === "sign" && (
        <div className="mockup-sign-object">
          <div className="mockup-sign-panel">{artwork}</div>
          <div className="mockup-sign-brand">{brand.name}</div>
        </div>
      )}
    </div>
  );
}
export function MockupView({ studio }: { studio: StudioState }) {
  const [template, setTemplate] = useState<MockupTemplate>("card");
  const [mode, setMode] = useState<ArtworkMode>("vector");
  const brand = studio.selectedBrand,
    concept = studio.selectedConcept;
  return (
    <section
      className="exploration-view mockup-view"
      aria-label="Brand applications"
    >
      <ViewHeading
        title="See the brand in context"
        description="Templates use your exact artwork, scaled into real-world formats. Nothing is regenerated."
      />
      {!brand || !concept ? (
        <ViewEmpty title="Select a concept">
          Choose a saved concept to preview its applications.
        </ViewEmpty>
      ) : (
        <>
          <div className="exploration-toolbar">
            <div
              className="mockup-template-tabs"
              role="group"
              aria-label="Application template"
            >
              {templates.map(({ id, label, Icon }) => (
                <button
                  type="button"
                  key={id}
                  aria-pressed={template === id}
                  onClick={() => setTemplate(id)}
                >
                  <Icon size={15} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <ArtworkModeSelect value={mode} onChange={setMode} />
          </div>
          <MockupScene
            concept={concept}
            brand={brand}
            mode={mode}
            template={template}
          />
          <p className="exploration-note">
            Application template · {concept.name} ·{" "}
            {mode === "image" && concept.raster
              ? "Original image"
              : "Editable composition"}
            . This is a presentation preview, not a production photograph or
            print proof.
          </p>
        </>
      )}
    </section>
  );
}
