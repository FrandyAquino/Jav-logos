import { expect, it } from "vitest";
import { assessDesign, contrastRatio } from "./design-quality";
import { DEFAULT_DNA } from "./brand-dna";
import { generateConcepts } from "./vector";
import { createStarterPaths } from "./vector-paths";
it("measures actual color contrast and reports explicit geometry/text limitations", () => {
  expect(contrastRatio("#000000", "#ffffff")).toBe(21);
  const document = generateConcepts(
    "brand",
    "Name",
    "mark",
    DEFAULT_DNA,
    1,
    42,
  )[0].document;
  const report = assessDesign({
    ...document,
    primary: "#eeeeee",
    background: "#ffffff",
    symbolOffsetX: 320,
    strokeWidth: 0.5,
  });
  expect(report.issues.map((issue) => issue.code)).toEqual(
    expect.arrayContaining(["contrast-low", "thin-stroke", "symbol-bounds"]),
  );
  expect(
    assessDesign({ ...document, symbolSource: "image" }).issues.some(
      (issue) => issue.code === "asset-colors",
    ),
  ).toBe(true);
});
it("distinguishes hidden slogans and warns when monochrome merges colored paths", () => {
  const doc = generateConcepts("brand", "Brand", "mark", DEFAULT_DNA, 1, 42)[0]
    .document;
  const hidden = {
    ...doc,
    showSymbol: false,
    showWordmark: false,
    slogan: "Slogan",
    showSlogan: false,
  };
  expect(
    assessDesign(hidden).issues.some((issue) => issue.code === "empty"),
  ).toBe(true);
  expect(
    assessDesign({ ...hidden, showSlogan: true }).issues.some(
      (issue) => issue.code === "empty",
    ),
  ).toBe(false);
  const paths = [
    ...createStarterPaths("#FFFFFF"),
    ...createStarterPaths("#000000"),
  ];
  expect(
    assessDesign({
      ...doc,
      symbolSource: "custom",
      paths,
      monochrome: true,
    }).issues.some((issue) => issue.code === "monochrome-flattening"),
  ).toBe(true);
});
