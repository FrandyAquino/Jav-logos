import { expect, it } from "vitest";
import { renderSvg, renderMotionSvg, generateConcepts } from "./vector";
import { createStarterPaths } from "./vector-paths";
import { DEFAULT_DNA } from "./brand-dna";
it("escapes user text and generates deterministic diverse geometry", () => {
  const concepts = generateConcepts(
    "id",
    "Jav <script>",
    "A calm geometric studio",
    DEFAULT_DNA,
    4,
    42,
  );
  expect(new Set(concepts.map((c) => c.document.shape)).size).toBe(4);
  const svg = renderSvg(concepts[0].document);
  expect(svg).not.toContain("<script>");
  expect(svg).toContain("&lt;script&gt;");
  expect(
    generateConcepts(
      "id",
      "Jav <script>",
      "A calm geometric studio",
      DEFAULT_DNA,
      4,
      42,
    ).map((c) => c.document),
  ).toEqual(concepts.map((c) => c.document));
});
it("keeps the legacy layout and separates editable wordmark/slogan/layers", () => {
  const doc = generateConcepts("brand", "Brand", "mark", DEFAULT_DNA, 1, 42)[0]
    .document;
  const legacy = renderSvg(doc);
  expect(legacy).toContain("translate(320 198)");
  expect(legacy).toContain('y="356"');
  expect(legacy).not.toContain("data-part");
  const expanded = renderSvg({
    ...doc,
    layout: "horizontal",
    slogan: "<script>unsafe</script>",
    symbolOffsetX: 10,
  });
  expect(expanded).toContain("translate(160 240)");
  expect(expanded).toContain('x="285"');
  expect(expanded).toContain("&lt;script&gt;unsafe&lt;/script&gt;");
  expect(renderSvg({ ...doc, layout: "symbol" })).not.toContain("<text");
  expect(renderSvg({ ...doc, layout: "wordmark" })).not.toContain(
    'data-part="symbol"',
  );
  const sloganOnly = renderSvg({
    ...doc,
    showWordmark: false,
    showSymbol: false,
    slogan: "Independent slogan",
  });
  expect(sloganOnly).toContain('data-part="slogan"');
  expect(sloganOnly).not.toContain('data-part="wordmark"');
});
it("uses explicit local image assets and editable paths without pretending raster recoloring", () => {
  const doc = generateConcepts("brand", "Brand", "mark", DEFAULT_DNA, 1, 42)[0]
    .document;
  expect(() =>
    renderSvg({ ...doc, symbolSource: "image" }, "https://evil.invalid/a.png"),
  ).toThrow();
  expect(
    renderSvg(
      { ...doc, symbolSource: "image" },
      "data:image/png;base64,aGVsbG8=",
    ),
  ).toContain("<image");
  expect(() =>
    renderSvg(
      { ...doc, symbolSource: "image", monochrome: true },
      "data:image/png;base64,aGVsbG8=",
    ),
  ).toThrow(/editable paths/);
  const paths = createStarterPaths("#123456");
  expect(renderSvg({ ...doc, symbolSource: "custom", paths })).toContain(
    'fill="#123456"',
  );
  expect(
    renderSvg({ ...doc, symbolSource: "custom", paths, monochrome: true }),
  ).not.toContain('fill="#123456"');
});
it("exports real motion with reduced-motion support and preserves inner transforms", () => {
  const doc = generateConcepts("brand", "Brand", "mark", DEFAULT_DNA, 1, 42)[0]
    .document;
  const motion = renderMotionSvg({ ...doc, motion: "draw" });
  expect(motion).toContain("@keyframes javlogos-draw");
  expect(motion).toContain('pathLength="1"');
  expect(motion).toContain("prefers-reduced-motion");
  expect(motion).toContain(
    `100%{stroke-dashoffset:0;fill-opacity:1;stroke-width:${doc.strokeWidth}}`,
  );
  expect(motion).toContain(`rect{stroke-width:${doc.strokeWidth}!important}`);
  expect(motion).not.toContain(
    "[data-part] *{animation:none!important;opacity:1!important;transform:none",
  );
  expect(() =>
    renderMotionSvg(
      { ...doc, symbolSource: "image", motion: "draw" },
      "data:image/png;base64,aGVsbG8=",
    ),
  ).toThrow(/editable vector/);
  expect(() =>
    renderMotionSvg({ ...doc, shape: "monogram", motion: "draw" }),
  ).toThrow(/editable vector/);
});
it("keeps light palette marks visible against the artboard", () => {
  const concepts = generateConcepts(
    "id",
    "Brand",
    "mark",
    { ...DEFAULT_DNA, palette: ["#F6F5F1", "#ffffff"] },
    2,
    42,
  );
  for (const concept of concepts)
    expect(concept.document.background).toBe("#202430");
});
