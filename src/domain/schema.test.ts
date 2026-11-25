import { expect, it } from "vitest";
import { workspaceSchema } from "./schema";
import { DEFAULT_DNA } from "./brand-dna";
import { generateConcepts } from "./vector";
it("rejects orphaned concepts and unsafe vector properties at the persistence boundary", () => {
  const id = crypto.randomUUID();
  const concept = generateConcepts(id, "Brand", "mark", DEFAULT_DNA, 1, 42)[0];
  expect(
    workspaceSchema.safeParse({
      schemaVersion: 1,
      revision: 0,
      brands: [],
      concepts: [concept],
    }).success,
  ).toBe(false);
  const workspace = {
    schemaVersion: 1,
    revision: 0,
    brands: [{ id, name: "Brand", parentId: null, dna: {}, createdAt: "now" }],
    concepts: [concept],
  };
  expect(workspaceSchema.safeParse(workspace).success).toBe(true);
  concept.document.primary = "url(https://evil.invalid)";
  expect(workspaceSchema.safeParse(workspace).success).toBe(false);
  concept.document.primary = "#112233";
  concept.raster = "https://evil.invalid/pixel.png";
  expect(workspaceSchema.safeParse(workspace).success).toBe(false);
});

it("requires cutout assets for current and saved compositions and bounds text fitting", async () => {
  const { documentSchema } = await import("./schema");
  const id = crypto.randomUUID();
  const concept = generateConcepts(id, "Brand", "mark", DEFAULT_DNA, 1, 42)[0];
  const workspace = {
    schemaVersion: 1,
    revision: 0,
    brands: [{ id, name: "Brand", parentId: null, dna: {}, createdAt: "now" }],
    concepts: [concept],
  };
  concept.document.useCutout = true;
  expect(workspaceSchema.safeParse(workspace).success).toBe(false);
  concept.cutout = "data:image/png;base64,aGVsbG8=";
  expect(workspaceSchema.safeParse(workspace).success).toBe(true);
  concept.versions.push({
    id: crypto.randomUUID(),
    createdAt: "now",
    document: { ...concept.document },
  });
  concept.document.useCutout = false;
  delete concept.cutout;
  expect(workspaceSchema.safeParse(workspace).success).toBe(false);
  expect(
    documentSchema.safeParse({ ...concept.document, wordmarkFit: 0 }).success,
  ).toBe(false);
  expect(
    documentSchema.safeParse({
      ...concept.document,
      wordmarkFit: 0.2,
      transparentBackground: true,
      autoFitText: true,
    }).success,
  ).toBe(true);
});
