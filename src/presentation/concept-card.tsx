import { Trash2 } from "lucide-react";
import type { Concept } from "../domain/types";
import { ConceptArtwork } from "./concept-artwork";

export function ConceptCard({
  concept,
  selected,
  layout,
  disabled,
  onSelect,
  onDelete,
}: {
  concept: Concept;
  selected: boolean;
  layout: "thumbnail" | "gallery";
  disabled: boolean;
  onSelect: () => void;
  onDelete: (trigger: HTMLButtonElement) => void;
}) {
  const gallery = layout === "gallery";
  return (
    <div className={`concept-card concept-card--${layout}`}>
      <button
        type="button"
        data-concept-select
        title={concept.name}
        aria-label={`Select ${concept.name}`}
        aria-pressed={selected}
        className={`${gallery ? "gallery-card" : "concept-thumbnail"} ${selected ? "selected" : ""}`}
        onClick={onSelect}
      >
        {gallery ? (
          <>
            <div className="gallery-art">
              <ConceptArtwork
                concept={concept}
                mode={concept.raster ? "image" : "vector"}
                alt=""
              />
            </div>
            <div className="gallery-caption">
              <strong>{concept.name}</strong>
              <span>{concept.raster ? "Local AI" : "Geometric"}</span>
            </div>
          </>
        ) : (
          <>
            <ConceptArtwork
              concept={concept}
              mode={concept.raster ? "image" : "vector"}
              alt=""
            />
            <span>{concept.name}</span>
          </>
        )}
      </button>
      <button
        type="button"
        className="concept-delete"
        title={`Delete ${concept.name}`}
        aria-label={`Delete ${concept.name}`}
        disabled={disabled}
        onClick={(event) => onDelete(event.currentTarget)}
      >
        <Trash2 size={13} aria-hidden="true" />
      </button>
    </div>
  );
}
