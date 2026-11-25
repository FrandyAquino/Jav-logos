import { fitDocumentText } from "./text-fitting";
import type { Font } from "fontkit";
import { bundledFont, fontBytes, fontLicense } from "./font-export";
import { renderSvg } from "../domain/vector";
import type { VectorDocument } from "../domain/types";

const loaded = new Map<string, Promise<Font>>();
async function load(path: string): Promise<Font> {
  let pending = loaded.get(path);
  if (!pending) {
    pending = Promise.all([import("fontkit"), fontBytes(path)]).then(
      ([kit, bytes]) => kit.create(bytes),
    );
    loaded.set(path, pending);
    pending.catch(() => loaded.delete(path));
  }
  return pending;
}
const NS = "http://www.w3.org/2000/svg";
const finite = (value: number) => {
  if (!Number.isFinite(value)) throw new Error("Invalid font geometry.");
  return Math.round(value * 100000) / 100000;
};
function variation(font: Font, weight: number, size: number): Font {
  const axes: Record<string, number> = {};
  for (const [axis, desired] of Object.entries({ wght: weight, opsz: size })) {
    const limits = font.variationAxes?.[axis];
    if (limits)
      axes[axis] = Math.max(limits.min, Math.min(limits.max, desired));
  }
  return Object.keys(axes).length ? font.getVariation(axes) : font;
}
export async function outlineComposition(
  doc: VectorDocument,
  asset?: string,
): Promise<string> {
  if (
    doc.symbolSource === "trace" &&
    doc.showSymbol !== false &&
    doc.layout !== "wordmark" &&
    asset?.startsWith("data:image/svg+xml;")
  ) {
    const comma = asset.indexOf(",");
    const source = asset.slice(0, comma).includes(";base64")
      ? atob(asset.slice(comma + 1))
      : decodeURIComponent(asset.slice(comma + 1));
    const trace = new DOMParser().parseFromString(source, "image/svg+xml");
    if (trace.querySelector("text,tspan,parsererror"))
      throw new Error(
        "This trace contains live text. Use a path-only symbol before exporting outlined artwork.",
      );
  }
  doc = await fitDocumentText(doc);
  const xml = new DOMParser().parseFromString(
    renderSvg(doc, asset),
    "image/svg+xml",
  );
  const texts = Array.from(xml.querySelectorAll("text"));
  if (!texts.length) return new XMLSerializer().serializeToString(xml);
  const manifest = bundledFont(doc.fontFamily);
  if (!manifest)
    throw new Error(
      `Outlining ${doc.fontFamily} requires its font file. Choose a bundled typeface such as Manrope or Google Sans Flex.`,
    );
  const faces = await Promise.all(
    manifest.faces.map(async (face) => ({
      ...face,
      font: await load(face.path),
    })),
  );
  for (const text of texts) {
    const value = (text.textContent ?? "").replace(/\s+/g, " ").trim();
    const size = Number(text.getAttribute("font-size") ?? 38);
    const weight = Number(text.getAttribute("font-weight") ?? 400);
    const spacing = Number(text.getAttribute("letter-spacing") ?? 0);
    const distance = (weights: string) =>
      Math.min(
        ...weights.split(/\s+/).map((w) => Math.abs(Number(w) - weight)),
      );
    const candidates = [...faces]
      .sort((a, b) => distance(a.weight) - distance(b.weight))
      .map((face) => variation(face.font, weight, size));
    const runs: { font: Font; text: string }[] = [];
    for (const { segment } of new Intl.Segmenter(undefined, {
      granularity: "grapheme",
    }).segment(value)) {
      const codes = Array.from(segment, (char) => char.codePointAt(0)!);
      const font = candidates.find((candidate) =>
        codes.every((code) => candidate.hasGlyphForCodePoint(code)),
      );
      if (!font)
        throw new Error(
          `The bundled ${doc.fontFamily} font does not contain “${segment}”. Change the text or typeface before outlining.`,
        );
      const previous = runs.at(-1);
      if (previous?.font === font) previous.text += segment;
      else runs.push({ font, text: segment });
    }
    const group = xml.createElementNS(NS, "g");
    for (const attr of Array.from(text.attributes))
      if (
        ![
          "x",
          "y",
          "font-family",
          "font-size",
          "font-weight",
          "letter-spacing",
          "text-anchor",
          "dominant-baseline",
        ].includes(attr.name)
      )
        group.setAttribute(attr.name, attr.value);
    group.setAttribute("data-outlined-text", value);
    let advance = 0;
    const pieces: { path: string; x: number; y: number; scale: number }[] = [];
    for (const run of runs) {
      const scale = size / run.font.unitsPerEm;
      const shaped = run.font.layout(run.text, {
        liga: spacing === 0,
        clig: spacing === 0,
      });
      shaped.glyphs.forEach((glyph, index) => {
        if (!glyph.id)
          throw new Error("A character could not be converted to an outline.");
        const position = shaped.positions[index];
        const path = glyph.path.toSVG();
        if (/NaN|Infinity/.test(path))
          throw new Error("Invalid glyph outline.");
        if (path)
          pieces.push({
            path,
            x: advance + position.xOffset * scale,
            y: -position.yOffset * scale,
            scale,
          });
        advance += position.xAdvance * scale + spacing;
      });
    }
    const x =
      Number(text.getAttribute("x") ?? 0) -
      (text.getAttribute("text-anchor") === "middle" ? advance / 2 : 0);
    const primaryFont = runs[0]?.font;
    const central =
      text.getAttribute("dominant-baseline") === "central" && primaryFont
        ? (((primaryFont.ascent + primaryFont.descent) / 2) * size) /
          primaryFont.unitsPerEm
        : 0;
    const y = Number(text.getAttribute("y") ?? 0) + central;
    let strokeOwner: Element | null = text;
    while (strokeOwner && !strokeOwner.hasAttribute("stroke-width"))
      strokeOwner = strokeOwner.parentElement;
    const strokeWidth = Number(strokeOwner?.getAttribute("stroke-width") ?? 0);
    for (const piece of pieces) {
      const path = xml.createElementNS(NS, "path");
      path.setAttribute("d", piece.path);
      if (strokeWidth > 0)
        path.setAttribute(
          "stroke-width",
          String(finite(strokeWidth / piece.scale)),
        );
      path.setAttribute(
        "transform",
        `translate(${finite(x + piece.x)} ${finite(y + piece.y)}) scale(${finite(piece.scale)} ${finite(-piece.scale)})`,
      );
      group.append(path);
    }
    text.replaceWith(group);
  }
  const metadata = xml.createElementNS(NS, "metadata");
  metadata.textContent = `${doc.fontFamily}\n${await fontLicense(doc.fontFamily)}\nText converted to outlines. Raster symbols, if present, remain raster.`;
  xml.documentElement.prepend(metadata);
  return new XMLSerializer().serializeToString(xml);
}
