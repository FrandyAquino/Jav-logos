import type { Concept } from "../domain/types";
import {
  applyCompositionChanges,
  type CompositionChanges,
} from "../domain/refinement";
import { fitDocumentText } from "./text-fitting";
import { prepareCompositionSvg } from "./font-export";
import { compositionAsset } from "./composition";
import { rasterize } from "./export";
import { prepareVariant } from "./delivery-variants";
import { silhouette, loadRaster } from "./raster-tools";
function pngUrl(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return `data:image/png;base64,${btoa(binary)}`;
}
export async function snapshotComposition(concept: Concept): Promise<string> {
  return pngUrl(
    await rasterize(
      await prepareCompositionSvg(concept.document, compositionAsset(concept)),
      640,
    ),
  );
}
export async function previewCompositionRefinement(
  source: Concept,
  changes: CompositionChanges,
): Promise<Concept> {
  const document = await fitDocumentText(
    applyCompositionChanges(source, changes),
  );
  const cutout = changes.symbolTint
    ? await silhouette(source.cutout!, changes.symbolTint)
    : source.cutout;
  return { ...source, document, ...(cutout ? { cutout } : {}) };
}
export async function prepareSymbolReference(source: Concept): Promise<string> {
  const variant = await prepareVariant(
    { ...source, document: { ...source.document, rotation: 0 } },
    "icon",
    false,
  );
  // Center the intrinsic symbol, then choose a contrasting AI input background.
  const { canvas, context } = await loadRaster(
    pngUrl(await rasterize(variant.svg, 512)),
  );
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let alpha = 0,
    light = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    const weight = pixels[index + 3] / 255;
    alpha += weight;
    light +=
      (weight *
        (pixels[index] * 0.2126 +
          pixels[index + 1] * 0.7152 +
          pixels[index + 2] * 0.0722)) /
      255;
  }
  if (!alpha) throw new Error("The symbol has no visible pixels to refine.");
  const opaqueImage =
    source.document.symbolSource === "image" && !source.document.useCutout;
  context.globalCompositeOperation = "destination-over";
  context.fillStyle =
    !opaqueImage && light / alpha > 0.65 ? "#172538" : "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}
