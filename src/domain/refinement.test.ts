import { expect, it } from "vitest";
import {
  applyCompositionChanges,
  buildSymbolRefinementPrompt,
  compositionColors,
} from "./refinement";
import { generateConcepts } from "./vector";
import { DEFAULT_DNA } from "./brand-dna";
import { createStarterPaths } from "./vector-paths";
const concept = () =>
  generateConcepts("brand", "Original", "direction", DEFAULT_DNA, 1, 42)[0];
it("changes explicit palette entries and typeface without changing geometry or the source", () => {
  const source = concept();
  source.document.symbolSource = "custom";
  source.document.paths = createStarterPaths("#123456");
  const before = structuredClone(source);
  const edited = applyCompositionChanges(source, {
    colors: { "#123456": "#ff0000" },
    fontFamily: "Manrope",
  });
  expect(edited.paths![0].fill).toBe("#ff0000");
  expect(edited.paths![0].contours).toEqual(source.document.paths[0].contours);
  expect(edited.primary).toBe(source.document.primary);
  expect(edited.fontFamily).toBe("Manrope");
  expect(source).toEqual(before);
  expect(compositionColors(source)).toContain("#123456");
});
it("rejects unsupported colors/fonts and tinting images without a cutout", () => {
  const source = concept();
  expect(() =>
    applyCompositionChanges(source, { colors: { "#000001": "#ffffff" } }),
  ).toThrow(/source/);
  expect(() =>
    applyCompositionChanges(source, { fontFamily: "url(evil)" }),
  ).toThrow();
  expect(() =>
    applyCompositionChanges(source, { symbolTint: "#ffffff" }),
  ).toThrow(/cutout/);
  source.document.symbolSource = "image";
  source.cutout = "data:image/png;base64,aA==";
  expect(
    applyCompositionChanges(source, { symbolTint: "#ffffff" }).useCutout,
  ).toBe(true);
});
it("bounds instructions and requests a symbol without raster typography", () => {
  expect(buildSymbolRefinementPrompt(" Simplify the curves ")).toContain(
    "Requested change: Simplify the curves",
  );
  expect(buildSymbolRefinementPrompt("Simplify")).toContain(
    "Do not add a wordmark",
  );
  expect(() => buildSymbolRefinementPrompt(" ")).toThrow();
  expect(() => buildSymbolRefinementPrompt("x".repeat(1501))).toThrow();
});
