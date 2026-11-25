import { strToU8, zipSync } from "fflate";
import { resolveDna } from "../domain/brand-dna";
import { prepareCompositionSvg, fontLicense } from "./font-export";
import type { Workspace } from "../domain/types";
import { sanitizeSvg } from "./svg";
import { compositionAsset } from "./composition";
export async function rasterize(
  svg: string,
  maxSize = 1280,
): Promise<Uint8Array> {
  if (!Number.isInteger(maxSize) || maxSize < 1 || maxSize > 4096)
    throw new Error("Invalid PNG export size.");
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
    const ratio = maxSize / Math.max(image.naturalWidth, image.naturalHeight);
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
      `${brand.name} — JavLogos brand kit\nTypography: ${dna.typography}\nTone: ${dna.tone}\nSVG text remains editable. Bundled open fonts are embedded with license metadata; system fonts still require installation. Fonts are not outlined. Original AI images and vector studies have distinct provenance in brand.json.\n`,
    ),
  };
  for (const [index, concept] of concepts.entries()) {
    const prefix = `concepts/${index + 1}-${concept.id}`;
    if (concept.raster)
      files[`${prefix}-original.png`] = Uint8Array.from(
        atob(concept.raster.split(",")[1]),
        (c) => c.charCodeAt(0),
      );
    if (concept.cutout)
      files[`${prefix}-cutout.png`] = Uint8Array.from(
        atob(concept.cutout.split(",")[1]),
        (c) => c.charCodeAt(0),
      );
    if (concept.reference)
      files[`${prefix}-reference.png`] = Uint8Array.from(
        atob(concept.reference.split(",")[1]),
        (c) => c.charCodeAt(0),
      );
    if (concept.tracedSvg)
      files[`${prefix}-trace.svg`] = strToU8(sanitizeSvg(concept.tracedSvg));
    const svg = await prepareCompositionSvg(
      concept.document,
      compositionAsset(concept),
    );
    files[`${prefix}-composition.svg`] = strToU8(svg);
    files[`${prefix}-composition.png`] = await rasterize(svg);
  }
  for (const family of new Set([
    dna.typography,
    ...concepts.map((c) => c.document.fontFamily),
  ])) {
    const license = await fontLicense(family);
    if (license)
      files[`licenses/${family.replace(/[^a-zA-Z0-9-]/g, "-")}.txt`] =
        strToU8(license);
  }
  return zipSync(files, { level: 6 });
}
