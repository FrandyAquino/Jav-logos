import svgpath from "svgpath";
import type { VectorContour, VectorNode, VectorPath } from "../domain/types";
import { validateVectorPaths } from "../domain/vector-paths";
import { sanitizeSvg } from "./svg";

const SVG = "http://www.w3.org/2000/svg";
const numeric = /[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi;
function transform(value: string): string {
  const expression =
    /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  if (value.replace(expression, "").replace(/[\s,]/g, ""))
    throw new Error("Unsupported SVG transform.");
  for (const match of value.matchAll(expression)) {
    const values = match[2].match(numeric)?.map(Number) ?? [];
    if (
      match[2].replace(numeric, "").replace(/[\s,]/g, "") ||
      values.some(
        (value) => !Number.isFinite(value) || Math.abs(value) > 1_000_000,
      )
    )
      throw new Error("Invalid SVG transform.");
    const counts: Record<string, number[]> = {
      matrix: [6],
      translate: [1, 2],
      scale: [1, 2],
      rotate: [1, 3],
      skewX: [1],
      skewY: [1],
    };
    if (!counts[match[1]].includes(values.length))
      throw new Error("Invalid SVG transform arguments.");
  }
  return value;
}
function inherited(element: Element, name: string, fallback: string): string {
  let current: Element | null = element;
  while (current) {
    const value = current.getAttribute(name);
    if (value !== null) return value;
    current = current.parentElement;
  }
  return fallback;
}
function solidColor(value: string): string {
  const color = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(color)) return color;
  if (/^#[0-9a-f]{3}$/.test(color))
    return (
      "#" +
      color
        .slice(1)
        .split("")
        .map((c) => c + c)
        .join("")
    );
  if (color === "black") return "#000000";
  if (color === "white") return "#ffffff";
  const rgb = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (rgb && rgb.slice(1).every((v) => Number(v) <= 255))
    return (
      "#" +
      rgb
        .slice(1)
        .map((v) => Number(v).toString(16).padStart(2, "0"))
        .join("")
    );
  throw new Error(
    "Only solid hex/RGB fills can be converted to editable paths.",
  );
}
function dimension(value: string | null): number {
  if (!value || !/^\d+(?:\.\d+)?(?:px)?$/.test(value))
    throw new Error("Trace needs a numeric viewBox or width and height.");
  return parseFloat(value);
}
export function importTracePaths(svg: string): VectorPath[] {
  if (svg.length > 8_000_000) throw new Error("Trace exceeds 8MB.");
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(svg))
    throw new Error("SVG document types and entities are not supported.");
  const original = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (
    original.querySelector("parsererror") ||
    original.documentElement.localName !== "svg" ||
    original.documentElement.namespaceURI !== SVG
  )
    throw new Error("Invalid SVG trace.");
  for (const element of original.querySelectorAll("*")) {
    if (
      element.namespaceURI !== SVG ||
      !["svg", "g", "path", "title", "desc", "metadata"].includes(
        element.localName,
      )
    )
      throw new Error(
        "Only filled SVG paths can be converted; expand other shapes or text first.",
      );
    if (element !== original.documentElement && element.localName === "svg")
      throw new Error("Nested SVG viewports are not supported.");
    for (const attribute of element.getAttributeNames()) {
      if (
        attribute === "style" ||
        attribute.startsWith("on") ||
        [
          "clip-path",
          "mask",
          "filter",
          "href",
          "xlink:href",
          "vector-effect",
          "display",
          "visibility",
        ].includes(attribute)
      )
        throw new Error("Unsupported SVG appearance or executable content.");
      if (
        ["opacity", "fill-opacity", "stroke-opacity"].includes(attribute) &&
        Number(element.getAttribute(attribute)) !== 1
      )
        throw new Error("Expand transparency before editing this trace.");
    }
    if (element.hasAttribute("transform"))
      transform(element.getAttribute("transform")!);
    if (element.localName === "path") {
      solidColor(inherited(element, "fill", "#000000"));
      if (inherited(element, "stroke", "none") !== "none")
        throw new Error(
          "Outline SVG strokes before converting them to filled paths.",
        );
    }
  }
  const document = new DOMParser().parseFromString(
    sanitizeSvg(svg),
    "image/svg+xml",
  );
  const root = document.documentElement;
  const viewBox = root.getAttribute("viewBox");
  const box = viewBox
    ? viewBox
        .trim()
        .split(/[\s,]+/)
        .map(Number)
    : [
        0,
        0,
        dimension(root.getAttribute("width")),
        dimension(root.getAttribute("height")),
      ];
  if (
    box.length !== 4 ||
    box.some((v) => !Number.isFinite(v) || Math.abs(v) > 1_000_000) ||
    box[2] <= 0 ||
    box[3] <= 0
  )
    throw new Error("Invalid SVG viewBox.");
  const scale = 180 / Math.max(box[2], box[3]);
  const centerX = box[0] + box[2] / 2,
    centerY = box[1] + box[3] / 2;
  const elements = Array.from(root.querySelectorAll("path"));
  if (!elements.length || elements.length > 100)
    throw new Error("Trace must contain between one and 100 paths.");
  const paths = elements.map((element) => {
    if (inherited(element, "stroke", "none") !== "none")
      throw new Error(
        "Outline SVG strokes before converting them to filled paths.",
      );
    const fill = solidColor(inherited(element, "fill", "#000000"));
    const fillRule = inherited(element, "fill-rule", "nonzero");
    if (fillRule !== "nonzero" && fillRule !== "evenodd")
      throw new Error("Unsupported SVG fill rule.");
    const transforms: string[] = [];
    let current: Element | null = element;
    while (current) {
      const value = current.getAttribute("transform");
      if (value) transforms.unshift(transform(value));
      current = current.parentElement;
    }
    const parsed = svgpath(element.getAttribute("d") ?? "");
    if ("err" in parsed && parsed.err)
      throw new Error("Trace contains an invalid SVG path.");
    parsed
      .abs()
      .unshort()
      .unarc()
      .transform(transforms.join(" "))
      .translate(-centerX, -centerY)
      .scale(scale);
    const contours: VectorContour[] = [];
    let contour: VectorContour | undefined;
    const node = (x: number, y: number): VectorNode => ({
      id: crypto.randomUUID(),
      x,
      y,
    });
    parsed.iterate((segment, _index, x, y) => {
      const value = (index: number) => Number(segment[index]);
      const command = segment[0].toUpperCase();
      if (command === "M") {
        contour = { closed: false, nodes: [node(value(1), value(2))] };
        contours.push(contour);
        return;
      }
      if (!contour) throw new Error("SVG path must start with a move command.");
      const previous = contour.nodes.at(-1)!;
      if (command === "L") contour.nodes.push(node(value(1), value(2)));
      else if (command === "H") contour.nodes.push(node(value(1), y));
      else if (command === "V") contour.nodes.push(node(x, value(1)));
      else if (command === "C") {
        Object.assign(previous, { outX: value(1), outY: value(2) });
        contour.nodes.push({
          ...node(value(5), value(6)),
          inX: value(3),
          inY: value(4),
        });
      } else if (command === "Q") {
        Object.assign(previous, {
          outX: x + (2 / 3) * (value(1) - x),
          outY: y + (2 / 3) * (value(2) - y),
        });
        contour.nodes.push({
          ...node(value(3), value(4)),
          inX: value(3) + (2 / 3) * (value(1) - value(3)),
          inY: value(4) + (2 / 3) * (value(2) - value(4)),
        });
      } else if (command === "Z") {
        contour.closed = true;
        const first = contour.nodes[0],
          last = contour.nodes.at(-1)!;
        if (
          contour.nodes.length > 1 &&
          Math.abs(first.x - last.x) < 1e-7 &&
          Math.abs(first.y - last.y) < 1e-7
        ) {
          if (last.inX !== undefined) {
            first.inX = last.inX;
            first.inY = last.inY;
          }
          contour.nodes.pop();
        }
      } else throw new Error(`Unsupported SVG path command ${command}.`);
    });
    return {
      id: crypto.randomUUID(),
      fill,
      fillRule,
      contours,
    } satisfies VectorPath;
  });
  validateVectorPaths(paths);
  return paths;
}
