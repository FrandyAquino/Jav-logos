import { z } from "zod";
import { validateHierarchy } from "./brand-dna";
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const png = z
  .string()
  .max(16_000_000)
  .regex(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/);
const shape = z.enum(["orbit", "petal", "monogram", "prism", "wave", "grid"]);
const font = z.enum([
  "Inter",
  "Avenir Next",
  "Georgia",
  "Helvetica Neue",
  "Courier New",
  "system-ui",
]);
export const dnaSchema = z.object({
  palette: z.array(color).min(1).max(8),
  typography: font,
  geometry: shape,
  tone: z.string().max(500),
});
export const documentSchema = z.object({
  shape,
  text: z.string().max(120),
  primary: color,
  background: color,
  fontFamily: font,
  scale: z.number().min(0.3).max(2),
  rotation: z.number().min(-180).max(180),
  letterSpacing: z.number().min(-5).max(30),
  strokeWidth: z.number().min(0).max(12),
});
const versionSchema = z.object({
  id: identifier,
  createdAt: z.string().max(64),
  document: documentSchema,
});
export const conceptSchema = z.object({
  id: identifier,
  brandId: identifier,
  name: z.string().max(120),
  prompt: z.string().max(4000),
  provider: z.string().max(100),
  seed: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  createdAt: z.string().max(64),
  document: documentSchema,
  raster: png.optional(),
  reference: png.optional(),
  generationContext: z
    .object({
      effectivePrompt: z.string().max(6000),
      dna: dnaSchema,
      width: z.number().int().min(256).max(1024),
      height: z.number().int().min(256).max(1024),
    })
    .optional(),
  tracedSvg: z.string().max(8_000_000).optional(),
  versions: z.array(versionSchema).max(100),
});
export const workspaceSchema = z
  .object({
    schemaVersion: z.literal(1),
    revision: z.number().int().nonnegative(),
    brands: z
      .array(
        z.object({
          id: identifier,
          name: z.string().trim().min(1).max(120),
          parentId: identifier.nullable(),
          dna: dnaSchema.partial(),
          createdAt: z.string().max(64),
        }),
      )
      .max(1000),
    concepts: z.array(conceptSchema).max(2000),
  })
  .superRefine((value, ctx) => {
    try {
      validateHierarchy(value.brands);
    } catch (error) {
      ctx.addIssue({ code: "custom", message: String(error) });
    }
    const brands = new Set(value.brands.map((b) => b.id));
    const ids = new Set<string>();
    for (const concept of value.concepts) {
      if (!brands.has(concept.brandId))
        ctx.addIssue({ code: "custom", message: "Concept brand is missing." });
      if (ids.has(concept.id))
        ctx.addIssue({
          code: "custom",
          message: "Duplicate concept identity.",
        });
      ids.add(concept.id);
    }
  });
