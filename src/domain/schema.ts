import { z } from "zod";
import { validateHierarchy } from "./brand-dna";
import fontFamilies from "../../shared/font-families.json";
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const png = z
  .string()
  .max(16_000_000)
  .regex(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/);
const shape = z.enum(["orbit", "petal", "monogram", "prism", "wave", "grid"]);
const font = z
  .string()
  .refine((value) => fontFamilies.includes(value), "Unsupported typography");
export const brandMetadataSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    status: z.enum(["active", "completed", "archived"]),
    pinned: z.boolean(),
    order: z.number().int().min(0).max(1_000_000),
    icon: z.enum([
      "diamond",
      "orbit",
      "flower",
      "type",
      "triangle",
      "waves",
      "grid",
      "layers",
      "spark",
    ]),
  })
  .partial();
export const dnaSchema = z.object({
  palette: z.array(color).min(1).max(8),
  typography: font,
  geometry: shape,
  tone: z.string().max(500),
});
const coordinate = z.number().finite().min(-1000).max(1000);
const nodeSchema = z
  .object({
    id: identifier,
    x: coordinate,
    y: coordinate,
    inX: coordinate.optional(),
    inY: coordinate.optional(),
    outX: coordinate.optional(),
    outY: coordinate.optional(),
  })
  .superRefine((node, ctx) => {
    if (
      (node.inX === undefined) !== (node.inY === undefined) ||
      (node.outX === undefined) !== (node.outY === undefined)
    )
      ctx.addIssue({
        code: "custom",
        message: "Bezier handles require paired coordinates.",
      });
  });
const contourSchema = z.object({
  nodes: z.array(nodeSchema).min(2).max(3000),
  closed: z.boolean(),
});
const pathSchema = z.object({
  id: identifier,
  fill: color,
  fillRule: z.enum(["nonzero", "evenodd"]).optional(),
  contours: z.array(contourSchema).min(1).max(200),
});
export const bookSchema = z
  .object({
    headline: z.string().max(200),
    overview: z.string().max(3000),
    usageNotes: z.string().max(3000),
    voice: z.string().max(1500),
  })
  .partial();
const offset = z.number().finite().min(-320).max(320).optional();
export const documentSchema = z
  .object({
    shape,
    text: z.string().max(120),
    primary: color,
    background: color,
    fontFamily: font,
    scale: z.number().min(0.3).max(2),
    rotation: z.number().min(-180).max(180),
    letterSpacing: z.number().min(-5).max(30),
    strokeWidth: z.number().min(0).max(12),
    layout: z.enum(["stacked", "horizontal", "symbol", "wordmark"]).optional(),
    slogan: z.string().max(200).optional(),
    symbolSource: z.enum(["geometric", "image", "trace", "custom"]).optional(),
    showSymbol: z.boolean().optional(),
    showWordmark: z.boolean().optional(),
    showSlogan: z.boolean().optional(),
    monochrome: z.boolean().optional(),
    wordmarkSize: z.number().min(12).max(96).optional(),
    sloganSize: z.number().min(10).max(40).optional(),
    symbolOffsetX: offset,
    symbolOffsetY: offset,
    wordmarkOffsetX: offset,
    wordmarkOffsetY: offset,
    sloganOffsetX: offset,
    sloganOffsetY: offset,
    paths: z.array(pathSchema).max(100).optional(),
    motion: z.enum(["none", "fade", "assemble", "draw"]).optional(),
  })
  .superRefine((doc, ctx) => {
    const contours = doc.paths?.flatMap((path) => path.contours) ?? [];
    const nodes = contours.flatMap((contour) => contour.nodes);
    if (contours.length > 200 || nodes.length > 3000)
      ctx.addIssue({
        code: "custom",
        message: "Vector document exceeds editing limits.",
      });
    if (doc.symbolSource === "custom" && !doc.paths?.length)
      ctx.addIssue({
        code: "custom",
        message: "Custom symbol requires editable paths.",
      });
    if (
      ["image", "trace"].includes(doc.symbolSource ?? "") &&
      (doc.monochrome || doc.motion === "draw")
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Convert the symbol to editable paths before monochrome or draw motion.",
      });
    if (
      new Set(doc.paths?.map((p) => p.id)).size !== (doc.paths?.length ?? 0) ||
      new Set([...(doc.paths ?? []), ...nodes].map((item) => item.id)).size !==
        (doc.paths?.length ?? 0) + nodes.length
    )
      ctx.addIssue({ code: "custom", message: "Duplicate vector identity." });
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
  favorite: z.boolean().optional(),
  notes: z.string().max(3000).optional(),
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
          book: bookSchema.optional(),
          status: z.enum(["active", "completed", "archived"]).optional(),
          pinned: z.boolean().optional(),
          order: z.number().int().min(0).max(1_000_000).optional(),
          icon: z
            .enum([
              "diamond",
              "orbit",
              "flower",
              "type",
              "triangle",
              "waves",
              "grid",
              "layers",
              "spark",
            ])
            .optional(),
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
      for (const doc of [
        concept.document,
        ...concept.versions.map((v) => v.document),
      ]) {
        if (
          (doc.symbolSource === "image" && !concept.raster) ||
          (doc.symbolSource === "trace" && !concept.tracedSvg)
        )
          ctx.addIssue({
            code: "custom",
            message: "Composition is missing its symbol asset.",
          });
      }
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
