import type { VectorDocument } from "./types";
export interface DesignIssue {
  code: string;
  severity: "warning" | "info";
  message: string;
}
function luminance(hex: string): number {
  const rgb = [1, 3, 5]
    .map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}
export function contrastRatio(first: string, second: string): number {
  const a = luminance(first),
    b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
export function assessDesign(doc: VectorDocument): {
  contrast: number;
  issues: DesignIssue[];
} {
  const contrast = contrastRatio(doc.primary, doc.background);
  const issues: DesignIssue[] = [];
  if (contrast < 3)
    issues.push({
      code: "contrast-low",
      severity: "warning",
      message: `Primary color contrast is ${contrast.toFixed(1)}:1 against the background; thin details can disappear.`,
    });
  else if (contrast < 4.5)
    issues.push({
      code: "contrast-small",
      severity: "info",
      message: `Contrast is ${contrast.toFixed(1)}:1. Inspect the wordmark at small sizes.`,
    });
  if (doc.strokeWidth > 0 && doc.strokeWidth * doc.scale < 1.5)
    issues.push({
      code: "thin-stroke",
      severity: "warning",
      message:
        "The symbol stroke is below 1.5 artboard units and can disappear when reduced.",
    });
  const layout = doc.layout ?? "stacked";
  const symbolVisible = layout !== "wordmark" && doc.showSymbol !== false;
  const textVisible = layout !== "symbol" && doc.showWordmark !== false;
  const sloganVisible =
    layout !== "symbol" && doc.showSlogan !== false && !!doc.slogan?.trim();
  if (symbolVisible) {
    if (
      doc.symbolSource === "custom" &&
      doc.monochrome &&
      new Set(doc.paths?.map((path) => path.fill.toLowerCase())).size > 1
    )
      issues.push({
        code: "monochrome-flattening",
        severity: "warning",
        message:
          "Monochrome gives every path the same fill, including white or background paths. Separate shapes may merge visually; remove unwanted background paths explicitly.",
      });
    const points =
      doc.symbolSource === "custom" && doc.paths?.length
        ? doc.paths.flatMap((p) =>
            p.contours.flatMap((c) =>
              c.nodes.flatMap((n) => [
                { x: n.x, y: n.y },
                ...(n.inX !== undefined ? [{ x: n.inX, y: n.inY! }] : []),
                ...(n.outX !== undefined ? [{ x: n.outX, y: n.outY! }] : []),
              ]),
            ),
          )
        : [
            { x: -95, y: -95 },
            { x: 95, y: -95 },
            { x: 95, y: 95 },
            { x: -95, y: 95 },
          ];
    const angle = (doc.rotation * Math.PI) / 180,
      c = Math.cos(angle),
      s = Math.sin(angle);
    const cx = (layout === "horizontal" ? 150 : 320) + (doc.symbolOffsetX ?? 0),
      cy = (layout === "stacked" ? 198 : 240) + (doc.symbolOffsetY ?? 0);
    if (
      points.some((p) => {
        const x = cx + (p.x * c - p.y * s) * doc.scale,
          y = cy + (p.x * s + p.y * c) * doc.scale;
        return x < 0 || x > 640 || y < 0 || y > 480;
      })
    )
      issues.push({
        code: "symbol-bounds",
        severity: "warning",
        message:
          "Symbol geometry or curve handles extend beyond the artboard. Inspect the edges before export.",
      });
    if (["image", "trace"].includes(doc.symbolSource ?? ""))
      issues.push({
        code: "asset-colors",
        severity: "info",
        message:
          "Contrast checks cover the composition color, not every color inside the imported symbol.",
      });
  }
  if (textVisible && doc.text) {
    const fit = doc.autoFitText ? (doc.wordmarkFit ?? 1) : 1;
    const size = (doc.wordmarkSize ?? 38) * fit;
    const estimatedWidth =
      Array.from(doc.text).length * size * 0.62 +
      Math.max(0, doc.text.length - 1) * doc.letterSpacing * fit;
    const x =
      (layout === "horizontal" ? 285 : 320) + (doc.wordmarkOffsetX ?? 0);
    const y =
      (layout === "stacked" ? 356 : layout === "horizontal" ? 245 : 240) +
      (doc.wordmarkOffsetY ?? 0);
    if (
      (layout === "horizontal"
        ? x + estimatedWidth > 640
        : x - estimatedWidth / 2 < 0 || x + estimatedWidth / 2 > 640) ||
      x < 0 ||
      y - size < 0 ||
      y > 480
    )
      issues.push({
        code: "wordmark-bounds",
        severity: "warning",
        message:
          "Estimated wordmark width or position may exceed the artboard. Actual font metrics can differ; check the preview.",
      });
    issues.push({
      code: "small-size",
      severity: "info",
      message:
        "Inspect the 16px and 32px previews; small-size legibility depends on the full wordmark and symbol.",
    });
  }
  if (!symbolVisible && (!textVisible || !doc.text.trim()) && !sloganVisible)
    issues.push({
      code: "empty",
      severity: "warning",
      message: "All visible logo layers are empty or hidden.",
    });
  return { contrast, issues };
}
