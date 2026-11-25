import { useEffect, useRef, useState } from "react";
import {
  Grid2X2,
  Image,
  Maximize,
  Plus,
  ScanLine,
  RefreshCw,
  Sparkles,
  Activity,
  Archive,
  CheckCircle2,
} from "lucide-react";
import type { Concept } from "../domain/types";
import { ConceptCard } from "./concept-card";
import { DeleteConceptDialog } from "./delete-concept-dialog";
import { GenerationBar } from "./generation-bar";
import { IconButton, Mark, type StudioState } from "./ui";
import { ConceptArtwork } from "./concept-artwork";
import {
  CompareView,
  MockupView,
  DnaMapView,
  MotionView,
} from "./studio-views";
import { VectorEditor } from "./vector-editor";
import { BrandBookView } from "./brand-book-view";
import "./brand-book.css";
import "./studio-navigation.css";
import {
  GenerationProgressPanel,
  generationIsActive,
  generationPhaseLabels,
} from "./generation-progress";

export function CreativeCanvas({
  studio,
  onCreate,
}: {
  studio: StudioState;
  onCreate: () => void;
}) {
  const workspaceRef = useRef<HTMLElement>(null);
  const deleteTrigger = useRef<HTMLButtonElement | null>(null);
  const [deleting, setDeleting] = useState<Pick<
    Concept,
    "id" | "name" | "brandId"
  > | null>(null);
  const requestDelete = (concept: Concept, trigger: HTMLButtonElement) => {
    deleteTrigger.current = trigger;
    setDeleting({
      id: concept.id,
      name: concept.name,
      brandId: concept.brandId,
    });
  };
  const restoreDeleteFocus = () => {
    if (deleteTrigger.current?.isConnected) deleteTrigger.current.focus();
    else {
      const selection = workspaceRef.current?.querySelector<HTMLButtonElement>(
        '[data-concept-select][aria-pressed="true"]',
      );
      (selection ?? workspaceRef.current)?.focus();
    }
  };
  const [gallery, setGallery] = useState(false);
  const [surface, setSurface] = useState<
    "canvas" | "compare" | "mockups" | "dna" | "edit" | "book" | "motion"
  >("canvas");
  const [viewActivity, setViewActivity] = useState(true);
  const [view, setView] = useState<"vector" | "image" | "trace">("image");
  const [previewBackground, setPreviewBackground] = useState<
    "paper" | "dark" | "grid"
  >("paper");
  const concepts = studio.workspace.concepts.filter(
    (concept) => concept.brandId === studio.selectedBrand?.id,
  );
  const selected = studio.selectedConcept;
  const generationActive = generationIsActive(studio);
  const showActivity = generationActive && viewActivity;
  useEffect(() => {
    if (studio.generationStartedAt !== null) setViewActivity(true);
  }, [studio.generationStartedAt]);
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
    <main
      ref={workspaceRef}
      tabIndex={-1}
      className="creative-workspace"
      aria-label="Creative workspace"
    >
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
          {studio.selectedBrand?.status === "completed" && (
            <span className="workspace-state">
              <CheckCircle2 size={13} /> Completed
            </span>
          )}
          {studio.selectedBrand?.status === "archived" && (
            <span className="workspace-state">
              <Archive size={13} /> Archived
            </span>
          )}
        </div>
        <div className="view-switch" role="group" aria-label="Workspace view">
          <IconButton
            label="Canvas view"
            active={!gallery && !showActivity}
            disabled={!concepts.length}
            onClick={() => {
              setGallery(false);
              setSurface("canvas");
              setViewActivity(false);
            }}
          >
            <Maximize size={15} />
          </IconButton>
          <IconButton
            label="Gallery view"
            active={gallery && !showActivity}
            disabled={!concepts.length}
            onClick={() => {
              setGallery(true);
              setSurface("canvas");
              setViewActivity(false);
            }}
          >
            <Grid2X2 size={15} />
          </IconButton>
          {generationActive && (
            <IconButton
              label="Generation activity"
              active={showActivity}
              onClick={() => setViewActivity(true)}
            >
              <Activity size={15} />
            </IconButton>
          )}
        </div>
      </div>
      {studio.selectedBrand && (
        <div className="studio-tools" role="group" aria-label="Studio tools">
          {(
            [
              ["compare", "Compare"],
              ["mockups", "Mockups"],
              ["dna", "DNA map"],
              ["edit", "Vector editor"],
              ["book", "Brand book"],
              ["motion", "Motion"],
            ] as const
          ).map(([id, label]) => (
            <button
              type="button"
              key={id}
              aria-pressed={surface === id && !showActivity}
              disabled={!["dna", "book"].includes(id) && !selected}
              onClick={() => {
                setSurface(id);
                setViewActivity(false);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {!showActivity && studio.generationProgress && (
        <details className="last-generation">
          <summary>
            <Activity size={14} />
            <span>
              {generationPhaseLabels[studio.generationProgress.phase] ||
                "Last generation"}
            </span>
            <span>View activity</span>
          </summary>
          <GenerationProgressPanel studio={studio} compact />
        </details>
      )}
      {showActivity ? (
        <GenerationProgressPanel studio={studio} />
      ) : surface === "compare" ? (
        <CompareView studio={studio} />
      ) : surface === "mockups" ? (
        <MockupView studio={studio} />
      ) : surface === "dna" ? (
        <DnaMapView studio={studio} />
      ) : surface === "edit" ? (
        <VectorEditor studio={studio} />
      ) : surface === "book" ? (
        <BrandBookView key={studio.selectedBrand?.id} studio={studio} />
      ) : surface === "motion" ? (
        <MotionView studio={studio} />
      ) : !studio.selectedBrand ? (
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
            <ConceptCard
              key={concept.id}
              concept={concept}
              selected={concept.id === selected?.id}
              layout="gallery"
              disabled={studio.busy}
              onSelect={() => {
                studio.selectConcept(concept.id);
                setGallery(false);
              }}
              onDelete={(trigger) => requestDelete(concept, trigger)}
            />
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
            <ConceptArtwork
              className="main-artwork"
              concept={selected}
              mode={effectiveView}
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
            {selected.raster ? (
              <button
                type="button"
                className="subtle-button"
                disabled={studio.busy || studio.referenceLoading}
                onClick={() => void studio.refineConcept()}
                title="Use this image and its prompt as the next reference"
              >
                <RefreshCw size={13} />
                Refine image
              </button>
            ) : (
              <span className="canvas-fit">Fit to canvas</span>
            )}
          </div>
          <div className="concept-strip" aria-label="Concepts">
            {concepts.map((concept) => (
              <ConceptCard
                key={concept.id}
                concept={concept}
                selected={concept.id === selected.id}
                layout="thumbnail"
                disabled={studio.busy}
                onSelect={() => studio.selectConcept(concept.id)}
                onDelete={(trigger) => requestDelete(concept, trigger)}
              />
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
      {deleting && (
        <DeleteConceptDialog
          concept={deleting}
          studio={studio}
          onClose={() => setDeleting(null)}
          restoreFocus={restoreDeleteFocus}
        />
      )}
    </main>
  );
}
