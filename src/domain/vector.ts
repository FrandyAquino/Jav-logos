import type { BrandDna, Concept, ShapeKind, VectorDocument } from "./types";
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
export function renderSvg(doc: VectorDocument): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480"><rect width="640" height="480" fill="${escapeXml(doc.background)}"/><g transform="translate(320 198) rotate(${doc.rotation}) scale(${doc.scale})" fill="${escapeXml(doc.primary)}" stroke="${escapeXml(doc.primary)}" stroke-width="${doc.strokeWidth}">${geometry(doc)}</g><text x="320" y="356" text-anchor="middle" fill="${escapeXml(doc.primary)}" font-family="${escapeXml(doc.fontFamily)}" font-size="38" font-weight="500" letter-spacing="${doc.letterSpacing}">${escapeXml(doc.text)}</text></svg>`;
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
