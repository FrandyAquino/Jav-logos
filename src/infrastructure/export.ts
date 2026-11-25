import { strToU8, zipSync } from "fflate";
import { resolveDna } from "../domain/brand-dna";
import { renderSvg } from "../domain/vector";
import type { Workspace } from "../domain/types";
import { sanitizeSvg } from "./svg";
export async function rasterize(svg: string): Promise<Uint8Array> {
  const image = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error("Unable to render SVG for PNG export."));
      image.src = url;
    });
    if (!image.naturalWidth || !image.naturalHeight)
      throw new Error("SVG has no usable dimensions.");
    const ratio = 1280 / Math.max(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("PNG renderer unavailable.");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("PNG encoding failed."))),
        "image/png",
      ),
    );
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function buildKit(
  workspace: Workspace,
  brandId: string,
): Promise<Uint8Array> {
  const brand = workspace.brands.find((b) => b.id === brandId);
  if (!brand) throw new Error("Select a brand first.");
  const dna = resolveDna(brandId, workspace.brands);
  const concepts = workspace.concepts.filter((c) => c.brandId === brandId);
  if (!concepts.length)
    throw new Error("Generate a concept before exporting a brand kit.");
  const files: Record<string, Uint8Array> = {
    "brand.json": strToU8(
      JSON.stringify({ schemaVersion: 1, brand, dna, concepts }, null, 2),
    ),
    "palette.css": strToU8(
      `:root {\n${dna.palette.map((c, i) => `  --brand-color-${i + 1}: ${c};`).join("\n")}\n}`,
    ),
    "README.txt": strToU8(
      `${brand.name} — JavLogos brand kit\nTypography: ${dna.typography}\nTone: ${dna.tone}\nSVG text remains editable and depends on installed fonts. Fonts are not bundled or outlined. Original AI images and vector studies have distinct provenance in brand.json.\n`,
    ),
  };
  for (const [index, concept] of concepts.entries()) {
    const prefix = `concepts/${index + 1}-${concept.id}`;
    if (concept.raster)
      files[`${prefix}-original.png`] = Uint8Array.from(
        atob(concept.raster.split(",")[1]),
        (c) => c.charCodeAt(0),
      );
    if (concept.reference)
      files[`${prefix}-reference.png`] = Uint8Array.from(
        atob(concept.reference.split(",")[1]),
        (c) => c.charCodeAt(0),
      );
    if (concept.tracedSvg)
      files[`${prefix}-trace.svg`] = strToU8(sanitizeSvg(concept.tracedSvg));
    const svg = renderSvg(concept.document);
    files[`${prefix}-composition.svg`] = strToU8(svg);
    files[`${prefix}-composition.png`] = await rasterize(svg);
  }
  return zipSync(files, { level: 6 });
}
