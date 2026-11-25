import { useState } from "react";
import {
  Grid2X2,
  Image,
  Layers3,
  Maximize,
  MousePointer2,
  Plus,
  ScanLine,
  Sparkles,
} from "lucide-react";
import { renderSvg } from "../domain/vector";
import type { Concept } from "../domain/types";
import { GenerationBar } from "./generation-bar";
import { IconButton, Mark, rasterUrl, svgUrl, type StudioState } from "./ui";

function artwork(concept: Concept, mode: "vector" | "image" | "trace") {
  if (mode === "image" && concept.raster) return rasterUrl(concept.raster);
  if (mode === "trace" && concept.tracedSvg) return svgUrl(concept.tracedSvg);
  return svgUrl(renderSvg(concept.document));
}

export function CreativeCanvas({
  studio,
  onCreate,
}: {
  studio: StudioState;
  onCreate: () => void;
}) {
  const [gallery, setGallery] = useState(false);
  const [view, setView] = useState<"vector" | "image" | "trace">("image");
  const [previewBackground, setPreviewBackground] = useState<
    "paper" | "dark" | "grid"
  >("paper");
  const concepts = studio.workspace.concepts.filter(
    (concept) => concept.brandId === studio.selectedBrand?.id,
  );
  const selected = studio.selectedConcept;
  const parent = studio.workspace.brands.find(
    (brand) => brand.id === studio.selectedBrand?.parentId,
  );
  return (
    <main className="creative-workspace" aria-label="Creative workspace">
      <div className="workspace-heading">
        <div className="breadcrumb">
          {parent && (
            <>
              <span>{parent.name}</span>
              <span className="slash">/</span>
            </>
          )}
          <strong>{studio.selectedBrand?.name ?? "Your brand studio"}</strong>
          {studio.selectedBrand && (
            <span className="workspace-tag">
              {parent ? "Sub-brand" : "Parent brand"}
            </span>
          )}
        </div>
        <div className="view-switch" aria-label="Workspace view">
          <IconButton
            label="Canvas view"
            active={!gallery}
            onClick={() => setGallery(false)}
          >
            <Maximize size={15} />
          </IconButton>
          <IconButton
            label="Gallery view"
            active={gallery}
            onClick={() => setGallery(true)}
          >
            <Grid2X2 size={15} />
          </IconButton>
        </div>
      </div>
      {!studio.selectedBrand ? (
        <div className="welcome-canvas">
          <div className="welcome-emblem">
            <Mark />
          </div>
          <span className="eyebrow">JAVCOLLECTIONS / CREATIVE TOOLS</span>
          <h1>
            A distinct identity.
            <br />A connected family.
          </h1>
          <p>
            Explore logos, shape your visual language, and build brands that
            belong together.
          </p>
          <button type="button" className="primary-button" onClick={onCreate}>
            <Plus size={16} /> Create your first brand
          </button>
          <div className="welcome-details">
            <span>
              <Layers3 size={14} /> Inherited Brand DNA
            </span>
            <span>
              <MousePointer2 size={14} /> Editable vectors
            </span>
          </div>
        </div>
      ) : !concepts.length ? (
        <div className="empty-canvas">
          <div className="empty-artboard">
            <span className="artboard-corner top-left" />
            <span className="artboard-corner bottom-right" />
            <Mark />
            <h2>Room for a new idea.</h2>
            <p>
              Describe your brand below and explore your first set of concepts.
            </p>
          </div>
        </div>
      ) : gallery ? (
        <div className="concept-gallery">
          {concepts.map((concept) => (
            <button
              type="button"
              className={`gallery-card ${concept.id === selected?.id ? "selected" : ""}`}
              key={concept.id}
              onClick={() => {
                studio.selectConcept(concept.id);
                setGallery(false);
              }}
            >
              <div className="gallery-art">
                <img
                  src={artwork(concept, concept.raster ? "image" : "vector")}
                  alt={`${concept.name} logo`}
                />
              </div>
              <div className="gallery-caption">
                <strong>{concept.name}</strong>
                <span>{concept.raster ? "Local AI" : "Geometric"}</span>
              </div>
            </button>
          ))}
        </div>
      ) : selected ? (
        <div className="canvas-content">
          <div className="artboard-meta">
            <span>{selected.name}</span>
            <span>
              {selected.raster ? "LOCAL AI" : "GEOMETRIC"}{" "}
              <span className="meta-dot">·</span>{" "}
              {selected.tracedSvg && view === "trace"
                ? "TRACED SVG"
                : selected.raster && view === "image"
                  ? "RASTER"
                  : "VECTOR"}
            </span>
          </div>
          <div className={`artboard ${previewBackground}`}>
            <img
              className="main-artwork"
              src={artwork(selected, view)}
              alt={`${selected.name} ${view === "image" ? "generated image" : "vector composition"}`}
            />
          </div>
          <div className="canvas-options">
            <div className="canvas-backgrounds" aria-label="Canvas surround">
              <button
                type="button"
                className={`background-swatch paper ${previewBackground === "paper" ? "active" : ""}`}
                aria-label="Light canvas surround"
                onClick={() => setPreviewBackground("paper")}
              />
              <button
                type="button"
                className={`background-swatch dark ${previewBackground === "dark" ? "active" : ""}`}
                aria-label="Dark canvas surround"
                onClick={() => setPreviewBackground("dark")}
              />
              <button
                type="button"
                className={`background-swatch grid ${previewBackground === "grid" ? "active" : ""}`}
                aria-label="Checkerboard canvas surround"
                onClick={() => setPreviewBackground("grid")}
              />
            </div>
            {selected.raster && (
              <div className="segmented-control">
                <button
                  type="button"
                  className={view === "image" ? "active" : ""}
                  onClick={() => setView("image")}
                >
                  <Image size={12} /> Original
                </button>
                <button
                  type="button"
                  className={view === "vector" ? "active" : ""}
                  onClick={() => setView("vector")}
                >
                  <ScanLine size={12} /> Composition
                </button>
                {selected.tracedSvg && (
                  <button
                    type="button"
                    className={view === "trace" ? "active" : ""}
                    onClick={() => setView("trace")}
                  >
                    <ScanLine size={12} /> Trace
                  </button>
                )}
              </div>
            )}
            <span className="canvas-fit">Fit to canvas</span>
          </div>
          <div className="concept-strip" aria-label="Concepts">
            {concepts.map((concept) => (
              <button
                type="button"
                title={concept.name}
                aria-label={`Select ${concept.name}`}
                aria-pressed={concept.id === selected.id}
                className={`concept-thumbnail ${concept.id === selected.id ? "selected" : ""}`}
                key={concept.id}
                onClick={() => studio.selectConcept(concept.id)}
              >
                <img
                  src={artwork(concept, concept.raster ? "image" : "vector")}
                  alt=""
                />
                <span>{concept.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="empty-canvas">
          <Sparkles />
          <p>Select a concept to begin editing.</p>
        </div>
      )}
      <GenerationBar studio={studio} />
    </main>
  );
}
