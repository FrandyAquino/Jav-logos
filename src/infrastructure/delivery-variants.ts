import { strToU8, zipSync } from "fflate";
import type { Concept, VectorDocument } from "../domain/types";
import { conceptSchema } from "../domain/schema";
import { compositionAsset } from "./composition";
import { prepareCompositionSvg, fontLicense } from "./font-export";
import { outlineComposition } from "./font-outlines";
import { importTracePaths } from "./trace-import";
import { silhouette } from "./raster-tools";
import { rasterize } from "./export";
export const DELIVERY_VARIANTS = [
  { id: "stacked", label: "Vertical" },
  { id: "horizontal", label: "Horizontal" },
  { id: "black", label: "Black" },
  { id: "white", label: "White" },
  { id: "icon", label: "Favicon" },
] as const;
export type DeliveryVariant = (typeof DELIVERY_VARIANTS)[number]["id"];
export interface PreparedVariant {
  id: DeliveryVariant;
  svg: string;
  containsRaster: boolean;
}
export function canMakeMonochrome(concept: Concept) {
  return (
    concept.document.symbolSource !== "image" ||
    Boolean(concept.cutout) ||
    concept.document.showSymbol === false
  );
}
function centerSymbol(doc: VectorDocument): VectorDocument {
  const points =
    doc.symbolSource === "custom" && doc.paths?.length
      ? doc.paths.flatMap((p) =>
          p.contours.flatMap((c) =>
            c.nodes.flatMap((n) => [
              [n.x, n.y],
              ...(n.inX !== undefined ? [[n.inX, n.inY!]] : []),
              ...(n.outX !== undefined ? [[n.outX, n.outY!]] : []),
            ]),
          ),
        )
      : [
          [-100, -100],
          [100, -100],
          [-100, 100],
          [100, 100],
        ];
  const angle = (doc.rotation * Math.PI) / 180;
  const xs = points.map(([x, y]) => x * Math.cos(angle) - y * Math.sin(angle));
  const ys = points.map(([x, y]) => x * Math.sin(angle) + y * Math.cos(angle));
  const left = Math.min(...xs),
    right = Math.max(...xs),
    top = Math.min(...ys),
    bottom = Math.max(...ys);
  const scale = Math.min(
    1,
    190 / Math.max(1, right - left + doc.strokeWidth),
    190 / Math.max(1, bottom - top + doc.strokeWidth),
  );
  return {
    ...doc,
    scale,
    symbolOffsetX: (-(left + right) / 2) * scale,
    symbolOffsetY: (-(top + bottom) / 2) * scale,
  };
}
export async function prepareVariant(
  input: Concept,
  id: DeliveryVariant,
  outlined: boolean,
): Promise<PreparedVariant> {
  const concept = conceptSchema.parse(input);
  if (id === "icon" && concept.document.showSymbol === false)
    throw new Error("Enable the symbol layer before exporting a favicon.");
  if (!DELIVERY_VARIANTS.some((v) => v.id === id))
    throw new Error("Unknown logo variant.");
  let doc: VectorDocument = {
    ...concept.document,
    layout:
      id === "horizontal" ? "horizontal" : id === "icon" ? "symbol" : "stacked",
    wordmarkOffsetX: 0,
    wordmarkOffsetY: 0,
    sloganOffsetX: 0,
    sloganOffsetY: 0,
    transparentBackground: true,
    autoFitText: true,
    motion: "none",
  };
  let asset = compositionAsset({ ...concept, document: doc });
  if (id === "black" || id === "white") {
    const color = id === "black" ? "#000000" : "#ffffff";
    if (doc.symbolSource === "image" && doc.showSymbol !== false) {
      if (!concept.cutout)
        throw new Error(
          "Save a transparent cutout before creating monochrome image variants.",
        );
      asset = await silhouette(concept.cutout, color);
      doc = { ...doc, primary: color, monochrome: false, useCutout: true };
    } else {
      if (doc.symbolSource === "trace" && doc.showSymbol !== false)
        doc = {
          ...doc,
          symbolSource: "custom",
          paths: importTracePaths(concept.tracedSvg ?? ""),
        };
      doc = { ...doc, primary: color, monochrome: true };
    }
  }
  doc = centerSymbol(doc);
  let svg = outlined
    ? await outlineComposition(doc, asset)
    : await prepareCompositionSvg(doc, asset);
  if (id === "icon")
    svg = svg.replace(
      'width="640" height="480" viewBox="0 0 640 480"',
      'width="64" height="64" viewBox="200 120 240 240"',
    );
  return {
    id,
    svg,
    containsRaster: svg.includes("<image") && doc.symbolSource === "image",
  };
}
export async function buildDeliveryKit(
  concept: Concept,
  ids: DeliveryVariant[],
  outlined: boolean,
): Promise<Uint8Array> {
  if (!ids.length || new Set(ids).size !== ids.length || ids.length > 5)
    throw new Error("Choose one to five unique variants.");
  const variants = await Promise.all(
    ids.map((id) => prepareVariant(concept, id, outlined)),
  );
  const files: Record<string, Uint8Array> = {};
  for (const variant of variants) {
    files[`${variant.id}.svg`] = strToU8(variant.svg);
    if (variant.id === "icon")
      for (const size of [16, 32, 48])
        files[`favicon-${size}.png`] = await rasterize(variant.svg, size);
    else files[`${variant.id}.png`] = await rasterize(variant.svg);
  }
  files["manifest.json"] = strToU8(
    JSON.stringify(
      {
        conceptId: concept.id,
        brandId: concept.brandId,
        textMode: outlined ? "outlined" : "editable",
        transparentCanvas: true,
        variants: variants.map(({ id, containsRaster }) => ({
          id,
          containsRaster,
        })),
        font: concept.document.fontFamily,
        sourceDocument: concept.document,
      },
      null,
      2,
    ),
  );
  const license = await fontLicense(concept.document.fontFamily);
  if (license) files["FONT-LICENSE.txt"] = strToU8(license);
  files["README.txt"] = strToU8(
    "JavLogos delivery variants\nDerived from the selected composition; original artwork remains unchanged. Text is fitted to each arrangement. Canvas backgrounds are transparent; an original raster symbol can still contain its own background. Use a cutout for transparent image symbols. White.svg requires a dark preview surface. Monochrome custom paths share one fill; inspect holes/background paths. Favicon contains the visible symbol only. SVGs with raster symbols remain hybrid artwork, not fully vector logos. Inspect small text and export colors before production.\n",
  );
  return zipSync(files, { level: 6 });
}
