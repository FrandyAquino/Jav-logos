import DOMPurify from "dompurify";
export function sanitizeSvg(svg: string): string {
  if (svg.length > 8_000_000)
    throw new Error("SVG exceeds the 8 MB import limit.");
  const cleaned = DOMPurify.sanitize(svg, {
    ALLOWED_TAGS: [
      "svg",
      "g",
      "path",
      "rect",
      "circle",
      "ellipse",
      "polygon",
      "polyline",
      "line",
      "text",
      "tspan",
      "title",
      "desc",
    ],
    ALLOWED_ATTR: [
      "xmlns",
      "viewBox",
      "width",
      "height",
      "d",
      "fill",
      "fill-rule",
      "stroke",
      "stroke-width",
      "stroke-linecap",
      "stroke-linejoin",
      "opacity",
      "transform",
      "x",
      "y",
      "x1",
      "x2",
      "y1",
      "y2",
      "cx",
      "cy",
      "r",
      "rx",
      "ry",
      "points",
      "font-family",
      "font-size",
      "font-weight",
      "text-anchor",
      "letter-spacing",
      "dominant-baseline",
    ],
    FORBID_TAGS: [
      "script",
      "foreignObject",
      "image",
      "use",
      "style",
      "animate",
    ],
    FORBID_ATTR: ["style", "href", "xlink:href"],
  });
  const parsed = new DOMParser().parseFromString(cleaned, "image/svg+xml");
  if (
    parsed.querySelector("parsererror") ||
    parsed.documentElement.localName !== "svg"
  )
    throw new Error("Invalid SVG image.");
  for (const node of parsed.querySelectorAll("*"))
    for (const attribute of Array.from(node.attributes))
      if (
        /url\s*\(|javascript:|data:|https?:/i.test(attribute.value) &&
        attribute.name !== "xmlns"
      )
        node.removeAttribute(attribute.name);
  return new XMLSerializer().serializeToString(parsed.documentElement);
}
