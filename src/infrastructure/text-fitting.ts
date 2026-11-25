import type { VectorDocument } from "../domain/types";

/** Store only uniform fit factors. Requested sizes and the editable strings remain intact. */
export async function fitDocumentText(
  input: VectorDocument,
): Promise<VectorDocument> {
  if (!input.autoFitText) return input;
  const doc = { ...input };
  const layout = doc.layout ?? "stacked";
  if (layout === "symbol") return { ...doc, wordmarkFit: 1, sloganFit: 1 };
  const family =
    doc.fontFamily === "system-ui"
      ? "system-ui"
      : JSON.stringify(doc.fontFamily);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context || !document.fonts)
    throw new Error("Text measurement is unavailable.");
  for (const part of ["wordmark", "slogan"] as const) {
    const text = part === "wordmark" ? doc.text : (doc.slogan ?? "");
    const visible =
      part === "wordmark"
        ? doc.showWordmark !== false
        : doc.showSlogan !== false;
    const size =
      part === "wordmark" ? (doc.wordmarkSize ?? 38) : (doc.sloganSize ?? 18);
    const x =
      (layout === "horizontal" ? 285 : 320) +
      (part === "wordmark"
        ? (doc.wordmarkOffsetX ?? 0)
        : (doc.sloganOffsetX ?? 0));
    const y =
      (layout === "stacked"
        ? part === "wordmark"
          ? 356
          : 396
        : layout === "horizontal"
          ? part === "wordmark"
            ? 245
            : 283
          : part === "wordmark"
            ? 240
            : 280) +
      (part === "wordmark"
        ? (doc.wordmarkOffsetY ?? 0)
        : (doc.sloganOffsetY ?? 0));
    const key = part === "wordmark" ? "wordmarkFit" : "sloganFit";
    if (!text.trim() || !visible) {
      doc[key] = 1;
      continue;
    }
    if (x <= 24 || x >= 616 || y <= 24 || y >= 456)
      throw new Error(
        "Move the text anchor inside the artboard margins before fitting it.",
      );
    const font = `${part === "wordmark" ? 500 : 400} ${size}px ${family}`;
    await document.fonts.load(font, text);
    context.font = font;
    context.textAlign = "left";
    const spacing = part === "wordmark" ? doc.letterSpacing : 0;
    context.letterSpacing = `${spacing}px`;
    const metrics = context.measureText(text.replace(/\s+/g, " ").trim());
    // Actual ink bounds include overhangs; horizontal text is anchored at the start.
    const anchor = layout === "horizontal" ? 0 : metrics.width / 2;
    const left = Math.max(0, metrics.actualBoundingBoxLeft + anchor);
    const right = Math.max(0, metrics.actualBoundingBoxRight - anchor);
    const limits = [
      1,
      left > 0 ? (x - 24) / left : 1,
      right > 0 ? (616 - x) / right : 1,
      metrics.actualBoundingBoxAscent > 0
        ? (y - 24) / metrics.actualBoundingBoxAscent
        : 1,
      metrics.actualBoundingBoxDescent > 0
        ? (456 - y) / metrics.actualBoundingBoxDescent
        : 1,
    ];
    const scale = Math.min(...limits);
    if (!Number.isFinite(scale) || scale < 0.001)
      throw new Error("Text is too large to fit on this artboard.");
    doc[key] =
      scale < 1
        ? Math.max(0.001, Math.floor(scale * 0.98 * 100000) / 100000)
        : 1;
  }
  return doc;
}
