// @vitest-environment jsdom
import { readFile } from "node:fs/promises";
import { expect, it, vi } from "vitest";
import manifest from "../../shared/font-assets.json";
import { outlineComposition } from "./font-outlines";
import { generateConcepts } from "../domain/vector";
import type { VectorDocument } from "../domain/types";
vi.mock("./text-fitting", () => ({
  fitDocumentText: async (doc: VectorDocument) => doc,
}));
import { DEFAULT_DNA } from "../domain/brand-dna";
vi.stubGlobal(
  "fetch",
  vi.fn(async (path: string) => {
    if (!path.startsWith("/fonts/") || path.includes(".."))
      throw new Error("Unexpected font request");
    const bytes = await readFile(`${process.cwd()}/public${path}`);
    return new Response(bytes);
  }),
);
const doc = generateConcepts(
  "brand",
  "Ñandú Áé — 2026",
  "mark",
  DEFAULT_DNA,
  1,
  42,
)[0].document;
it.each(manifest.map((font) => font.family))(
  "outlines real bundled %s glyphs, accents and monogram without live fonts",
  async (fontFamily) => {
    const svg = await outlineComposition({
      ...doc,
      fontFamily,
      shape: "monogram",
      layout: "stacked",
      slogan: "Diseño & conexión",
      transparentBackground: true,
    });
    expect(svg).not.toContain("<text");
    expect(svg).not.toContain("data:font/");
    expect(svg).toContain("<path");
    expect(svg).toContain("SIL OPEN FONT LICENSE");
    expect(
      new DOMParser()
        .parseFromString(svg, "image/svg+xml")
        .querySelectorAll("[data-outlined-text]"),
    ).toHaveLength(3);
  },
);
it("rejects unavailable system-font files and missing glyphs instead of substituting them", async () => {
  await expect(
    outlineComposition({ ...doc, fontFamily: "Avenir Next" }),
  ).rejects.toThrow(/requires its font file/);
  await expect(
    outlineComposition({ ...doc, fontFamily: "Manrope", text: "标志" }),
  ).rejects.toThrow(/does not contain/);
});
it("applies variable weight differences and preserves the fitted layer transform", async () => {
  const normal = await outlineComposition({
    ...doc,
    fontFamily: "Manrope",
    shape: "monogram",
    autoFitText: true,
    wordmarkFit: 0.5,
    slogan: "Ñandú Áé — 2026",
  });
  const parsed = new DOMParser().parseFromString(normal, "image/svg+xml");
  expect(
    parsed
      .querySelector('[data-part="wordmark"] > g')
      ?.getAttribute("transform"),
  ).toContain("scale(0.5)");
  expect(
    parsed.querySelector('[data-part="wordmark"] path')?.getAttribute("d"),
  ).not.toBe(
    parsed.querySelector('[data-part="slogan"] path')?.getAttribute("d"),
  );
});

it("refuses live text inside a nested trace instead of claiming a font-independent export", async () => {
  const asset = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"><text>Unoutlined</text></svg>')}`;
  await expect(
    outlineComposition(
      { ...doc, fontFamily: "Manrope", symbolSource: "trace" },
      asset,
    ),
  ).rejects.toThrow(/live text/);
});
