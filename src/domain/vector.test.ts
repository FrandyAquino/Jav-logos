import { expect, it } from "vitest";
import { renderSvg, generateConcepts } from "./vector";
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
