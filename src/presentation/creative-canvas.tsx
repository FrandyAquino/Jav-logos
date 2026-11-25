import { useState } from "react";
import {
  Grid2X2,
  Image,
  Maximize,
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
  const effectiveView =
    view === "trace" && selected?.tracedSvg
      ? "trace"
      : view === "image" && selected?.raster
        ? "image"
        : "vector";
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
        <div className="view-switch" role="group" aria-label="Workspace view">
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
          <h1>Create a home for your brand</h1>
          <p>
            Start with a name and a visual direction. Add related brands as your
            identity grows.
          </p>
          <button type="button" className="primary-button" onClick={onCreate}>
            <Plus size={16} /> Create your first brand
          </button>
        </div>
      ) : !concepts.length ? (
        <div className="empty-canvas">
          <div className="empty-artboard">
            <span className="artboard-corner top-left" />
            <span className="artboard-corner bottom-right" />
            <Mark />
            <h2>Explore your first concepts</h2>
            <p>
              Describe a direction below. Choose geometric concepts for editable
              vectors, or local AI for generated images.
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
              aria-pressed={concept.id === selected?.id}
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
              {selected.raster ? "Local AI" : "Geometric"}{" "}
              <span className="meta-dot">·</span>{" "}
              {effectiveView === "trace"
                ? "Traced SVG"
                : effectiveView === "image"
                  ? "Original image"
                  : "Editable composition"}
            </span>
          </div>
          <div className={`artboard ${previewBackground}`}>
            <img
              className="main-artwork"
              src={artwork(selected, effectiveView)}
              alt={`${selected.name}: ${effectiveView === "image" ? "original generated image" : effectiveView === "trace" ? "traced vector" : "editable vector composition"}`}
            />
          </div>
          <div className="canvas-options">
            <div
              className="canvas-backgrounds"
              role="group"
              aria-label="Canvas surround"
            >
              <button
                type="button"
                className={`background-swatch paper ${previewBackground === "paper" ? "active" : ""}`}
                aria-label="Light canvas surround"
                title="Light canvas surround"
                aria-pressed={previewBackground === "paper"}
                onClick={() => setPreviewBackground("paper")}
              />
              <button
                type="button"
                className={`background-swatch dark ${previewBackground === "dark" ? "active" : ""}`}
                aria-label="Dark canvas surround"
                title="Dark canvas surround"
                aria-pressed={previewBackground === "dark"}
                onClick={() => setPreviewBackground("dark")}
              />
              <button
                type="button"
                className={`background-swatch grid ${previewBackground === "grid" ? "active" : ""}`}
                aria-label="Checkerboard canvas surround"
                title="Checkerboard canvas surround"
                aria-pressed={previewBackground === "grid"}
                onClick={() => setPreviewBackground("grid")}
              />
            </div>
            {selected.raster && (
              <div
                className="segmented-control"
                role="group"
                aria-label="Artwork format"
              >
                <button
                  type="button"
                  className={effectiveView === "image" ? "active" : ""}
                  aria-pressed={effectiveView === "image"}
                  onClick={() => setView("image")}
                >
                  <Image size={12} /> Original
                </button>
                <button
                  type="button"
                  className={effectiveView === "vector" ? "active" : ""}
                  aria-pressed={effectiveView === "vector"}
                  onClick={() => setView("vector")}
                >
                  <ScanLine size={12} /> Composition
                </button>
                {selected.tracedSvg && (
                  <button
                    type="button"
                    className={effectiveView === "trace" ? "active" : ""}
                    aria-pressed={effectiveView === "trace"}
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
