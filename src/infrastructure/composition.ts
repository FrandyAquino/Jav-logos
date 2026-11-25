import type { Concept } from "../domain/types";
import { sanitizeSvg } from "./svg";
export function compositionAsset(concept: Concept): string | undefined {
  if (concept.document.symbolSource === "image")
    return concept.document.useCutout ? concept.cutout : concept.raster;
  if (concept.document.symbolSource === "trace" && concept.tracedSvg)
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sanitizeSvg(concept.tracedSvg))}`;
  return undefined;
}
