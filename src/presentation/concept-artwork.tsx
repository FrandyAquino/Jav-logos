import type { Concept } from "../domain/types";
import { renderSvg } from "../domain/vector";
import { rasterUrl, svgUrl } from "./ui";
import { compositionAsset } from "../infrastructure/composition";
export function ConceptArtwork({
  concept,
  mode,
  alt,
  className = "",
}: {
  concept: Concept;
  mode: "vector" | "image" | "trace";
  alt: string;
  className?: string;
}) {
  if (mode === "image" && concept.raster)
    return (
      <img className={className} src={rasterUrl(concept.raster)} alt={alt} />
    );
  if (mode === "trace" && concept.tracedSvg)
    return (
      <img className={className} src={svgUrl(concept.tracedSvg)} alt={alt} />
    );
  // Only our escaped, typed primitive renderer enters the DOM; imported SVG remains an image.
  return (
    <div
      className={`composition-preview ${className}`}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={!alt || undefined}
      dangerouslySetInnerHTML={{
        __html: renderSvg(concept.document, compositionAsset(concept)),
      }}
    />
  );
}
