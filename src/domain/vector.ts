import type { BrandDna, Concept, ShapeKind, VectorDocument } from "./types";
import { pathData, validateVectorPaths } from "./vector-paths";
export const SHAPES: ShapeKind[] = [
  "orbit",
  "petal",
  "monogram",
  "prism",
  "wave",
  "grid",
];
const escapeXml = (s: string) =>
  s.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
function geometry(doc: VectorDocument): string {
  switch (doc.shape) {
    case "orbit":
      return '<path fill-rule="evenodd" d="M0-82a82 82 0 1 0 0 164 82 82 0 0 0 0-164Zm0 24a58 58 0 1 1 0 116 58 58 0 0 1 0-116Z"/><path d="M-95 35 52-92 74-68-73 59Z"/>';
    case "petal":
      return [0, 72, 144, 216, 288]
        .map(
          (r) =>
            `<ellipse cx="0" cy="-39" rx="27" ry="49" transform="rotate(${r})"/>`,
        )
        .join("");
    case "monogram":
      return `<text text-anchor="middle" dominant-baseline="central" font-family="${escapeXml(doc.fontFamily)}" font-size="160" font-weight="700">${escapeXml(Array.from(doc.text.trim())[0] || "J")}</text>`;
    case "prism":
      return '<path d="M0-92 86 59H58L0-43-58 59H-86Z"/><path d="M0-10 41 61H-41Z"/>';
    case "wave":
      return '<path d="M-90 12Q-45-100 0-12T90-12V24Q45 112 0 24T-90 48Z"/>';
    case "grid":
      return [-1, 0, 1]
        .flatMap((x) =>
          [-1, 0, 1].map(
            (y) =>
              `<rect x="${x * 53 - 21}" y="${y * 53 - 21}" width="42" height="42" rx="${x === y ? 21 : 5}"/>`,
          ),
        )
        .join("");
  }
}
function legacySvg(doc: VectorDocument): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480"><rect width="640" height="480" fill="${escapeXml(doc.background)}"/><g transform="translate(320 198) rotate(${doc.rotation}) scale(${doc.scale})" fill="${escapeXml(doc.primary)}" stroke="${escapeXml(doc.primary)}" stroke-width="${doc.strokeWidth}">${geometry(doc)}</g><text x="320" y="356" text-anchor="middle" fill="${escapeXml(doc.primary)}" font-family="${escapeXml(doc.fontFamily)}" font-size="38" font-weight="500" letter-spacing="${doc.letterSpacing}">${escapeXml(doc.text)}</text></svg>`;
}
const expandedFields: (keyof VectorDocument)[] = [
  "transparentBackground",
  "autoFitText",
  "wordmarkFit",
  "sloganFit",
  "useCutout",
  "layout",
  "slogan",
  "symbolSource",
  "showSymbol",
  "showWordmark",
  "showSlogan",
  "monochrome",
  "wordmarkSize",
  "sloganSize",
  "symbolOffsetX",
  "symbolOffsetY",
  "wordmarkOffsetX",
  "wordmarkOffsetY",
  "sloganOffsetX",
  "sloganOffsetY",
  "paths",
  "motion",
];
function safeAsset(url: string | undefined): string {
  if (
    !url ||
    Array.from(url).some((character) => character.charCodeAt(0) < 32) ||
    !/^(data:image\/png;base64,[A-Za-z0-9+/]+={0,2}|data:image\/svg\+xml;(?:base64,[A-Za-z0-9+/]+={0,2}|charset=utf-8,[^<>]+))$/.test(
      url,
    )
  )
    throw new Error(
      "Composition symbol requires an approved local image asset.",
    );
  return escapeXml(url);
}
export function renderSvg(doc: VectorDocument, symbolDataUrl?: string): string {
  if (expandedFields.every((key) => doc[key] === undefined))
    return legacySvg(doc);
  const layout = doc.layout ?? "stacked",
    source = doc.symbolSource ?? "geometric";
  const hasSymbol = layout !== "wordmark" && doc.showSymbol !== false;
  const hasWordmark = layout !== "symbol" && doc.showWordmark !== false;
  const symbolX =
    (layout === "horizontal" ? 150 : 320) + (doc.symbolOffsetX ?? 0);
  const symbolY = (layout === "stacked" ? 198 : 240) + (doc.symbolOffsetY ?? 0);
  const wordX =
    (layout === "horizontal" ? 285 : 320) + (doc.wordmarkOffsetX ?? 0);
  const wordY =
    (layout === "stacked" ? 356 : layout === "horizontal" ? 245 : 240) +
    (doc.wordmarkOffsetY ?? 0);
  const sloganX =
    (layout === "horizontal" ? 285 : 320) + (doc.sloganOffsetX ?? 0);
  const sloganY =
    (layout === "stacked" ? 396 : layout === "horizontal" ? 283 : 280) +
    (doc.sloganOffsetY ?? 0);
  const anchor = layout === "horizontal" ? "start" : "middle";
  let symbol = "";
  if (hasSymbol) {
    if ((source === "image" || source === "trace") && doc.monochrome)
      throw new Error(
        "Convert the symbol to editable paths before making it monochrome.",
      );
    if (source === "image" || source === "trace")
      symbol = `<image x="-90" y="-90" width="180" height="180" preserveAspectRatio="xMidYMid meet" href="${safeAsset(symbolDataUrl)}"/>`;
    else if (source === "custom") {
      if (!doc.paths?.length)
        throw new Error("Custom symbol has no editable paths.");
      validateVectorPaths(doc.paths);
      symbol = doc.paths
        .map(
          (path) =>
            `<path d="${pathData(path)}" fill="${escapeXml(doc.monochrome ? doc.primary : path.fill)}" fill-rule="${path.fillRule ?? "nonzero"}"/>`,
        )
        .join("");
    } else symbol = geometry(doc);
  }
  const textTransform = (x: number, y: number, scale: number | undefined) =>
    doc.autoFitText && scale !== undefined && scale < 1
      ? ` transform="translate(${x} ${y}) scale(${scale}) translate(${-x} ${-y})"`
      : "";
  const wordmark = hasWordmark
    ? `<g data-part="wordmark"><text${textTransform(wordX, wordY, doc.wordmarkFit)} x="${wordX}" y="${wordY}" text-anchor="${anchor}" fill="${escapeXml(doc.primary)}" font-family="${escapeXml(doc.fontFamily)}" font-size="${doc.wordmarkSize ?? 38}" font-weight="500" letter-spacing="${doc.letterSpacing}">${escapeXml(doc.text)}</text></g>`
    : "";
  const slogan =
    layout !== "symbol" && doc.showSlogan !== false && doc.slogan
      ? `<g data-part="slogan"><text${textTransform(sloganX, sloganY, doc.sloganFit)} x="${sloganX}" y="${sloganY}" text-anchor="${anchor}" fill="${escapeXml(doc.primary)}" font-family="${escapeXml(doc.fontFamily)}" font-size="${doc.sloganSize ?? 18}" font-weight="400">${escapeXml(doc.slogan)}</text></g>`
      : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">${doc.transparentBackground ? "" : `<rect width="640" height="480" fill="${escapeXml(doc.background)}"/>`}${hasSymbol ? `<g data-part="symbol"><g transform="translate(${symbolX} ${symbolY}) rotate(${doc.rotation}) scale(${doc.scale})" fill="${escapeXml(doc.primary)}" stroke="${escapeXml(doc.primary)}" stroke-width="${doc.strokeWidth}">${symbol}</g></g>` : ""}${wordmark}${slogan}</svg>`;
}
export function renderMotionSvg(
  doc: VectorDocument,
  symbolDataUrl?: string,
): string {
  const motion = doc.motion ?? "none";
  if (!/^#[0-9a-f]{6}$/i.test(doc.primary))
    throw new Error("Motion color must be a six-digit hex value.");
  if (
    motion === "draw" &&
    (doc.showSymbol === false ||
      doc.layout === "wordmark" ||
      ["image", "trace"].includes(doc.symbolSource ?? "geometric") ||
      ((doc.symbolSource ?? "geometric") === "geometric" &&
        doc.shape === "monogram"))
  )
    throw new Error("Draw animation requires editable vector geometry.");
  let svg = renderSvg({ ...doc, motion }, symbolDataUrl);
  if (motion === "none") return svg;
  const rules =
    motion === "fade"
      ? '[data-part]{animation:javlogos-fade 1.2s ease-out both}[data-part="wordmark"]{animation-delay:.12s}[data-part="slogan"]{animation-delay:.24s}'
      : motion === "assemble"
        ? '[data-part="symbol"]{animation:javlogos-assemble 1.2s ease-out both;transform-origin:320px 240px}[data-part="wordmark"],[data-part="slogan"]{animation:javlogos-fade .8s ease-out .4s both}'
        : `[data-part="symbol"] path,[data-part="symbol"] ellipse,[data-part="symbol"] rect{stroke:${doc.primary};stroke-width:${Math.max(doc.strokeWidth, 1.5)};stroke-dasharray:1;animation:javlogos-draw 2s ease-out both}[data-part="wordmark"],[data-part="slogan"]{animation:javlogos-fade .7s ease-out 1.2s both}`;
  if (motion === "draw")
    svg = svg.replace(
      /<(path|ellipse|rect)(?=\s)/g,
      (match, _tag, offset: number) =>
        offset > svg.indexOf('data-part="symbol"') &&
        offset < svg.indexOf("</g></g>")
          ? `${match} pathLength="1"`
          : match,
    );
  const style = `<style>${rules}@keyframes javlogos-fade{from{opacity:0}to{opacity:1}}@keyframes javlogos-assemble{from{opacity:0;transform:translateY(18px) scale(.88)}to{opacity:1;transform:none}}@keyframes javlogos-draw{0%{stroke-dashoffset:1;fill-opacity:0}65%{fill-opacity:0}100%{stroke-dashoffset:0;fill-opacity:1;stroke-width:${doc.strokeWidth}}}@media(prefers-reduced-motion:reduce){[data-part],[data-part] *{animation:none!important;opacity:1!important;stroke-dasharray:none!important;fill-opacity:1!important}[data-part]{transform:none!important}[data-part="symbol"] path,[data-part="symbol"] ellipse,[data-part="symbol"] rect{stroke-width:${doc.strokeWidth}!important}}</style>`;
  return svg.replace(/(<svg\b[^>]*>)/, `$1${style}`);
}
export function generateConcepts(
  brandId: string,
  name: string,
  prompt: string,
  dna: BrandDna,
  count: number,
  seed: number,
): Concept[] {
  return Array.from({ length: Math.min(4, Math.max(1, count)) }, (_, i) => {
    const shape = SHAPES[(SHAPES.indexOf(dna.geometry) + i) % SHAPES.length];
    const primary = dna.palette[i % dna.palette.length];
    const rgb = [1, 3, 5].map(
      (offset) => parseInt(primary.slice(offset, offset + 2), 16) / 255,
    );
    const brightness = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    return {
      id: crypto.randomUUID(),
      brandId,
      name: `${shape[0].toUpperCase() + shape.slice(1)} study`,
      prompt,
      provider: "Procedural geometry",
      seed: seed + i,
      createdAt: new Date().toISOString(),
      document: {
        shape,
        text: name,
        primary,
        background: brightness > 0.65 ? "#202430" : "#F6F5F1",
        fontFamily: dna.typography,
        scale: 1,
        rotation: 0,
        letterSpacing: Math.abs(seed % 4),
        strokeWidth: 0,
      },
      versions: [],
    };
  });
}
