import { z } from "zod";
import fontFamilies from "../../shared/font-families.json";
import type { Concept, VectorDocument } from "./types";
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const compositionChangesSchema = z.object({
  colors: z
    .record(color, color)
    .refine((value) => Object.keys(value).length <= 101)
    .default({}),
  background: color.optional(),
  fontFamily: z
    .string()
    .refine((value) => fontFamilies.includes(value), "Unsupported typography")
    .optional(),
  symbolTint: color.optional(),
});
export type CompositionChanges = z.input<typeof compositionChangesSchema>;
export const refinementInstructionSchema = z
  .string()
  .trim()
  .min(1, "Describe what should change.")
  .max(1500)
  .refine(
    (value) => !value.includes("\0"),
    "Instruction contains an invalid character.",
  );
export const REFINEMENT_PRESETS = [
  {
    id: "simplify",
    label: "Simplify",
    instruction:
      "Simplify this symbol by removing secondary details. Preserve its distinctive silhouette, main proportions and existing palette. Make it readable at small sizes.",
  },
  {
    id: "geometric",
    label: "More geometric",
    instruction:
      "Reinterpret this symbol with precise geometric shapes, consistent angles and balanced negative space. Preserve its recognizable idea and existing palette.",
  },
  {
    id: "organic",
    label: "More organic",
    instruction:
      "Reinterpret this symbol with softer organic curves and a balanced silhouette. Preserve its recognizable idea and existing palette.",
  },
] as const;
export function compositionColors(concept: Concept): string[] {
  return [
    ...new Set(
      [
        concept.document.primary,
        ...(concept.document.symbolSource === "custom" &&
        !concept.document.monochrome
          ? (concept.document.paths?.map((path) => path.fill) ?? [])
          : []),
      ].map((value) => value.toLowerCase()),
    ),
  ];
}
export function applyCompositionChanges(
  concept: Concept,
  input: CompositionChanges,
): VectorDocument {
  const changes = compositionChangesSchema.parse(input);
  const available = new Set(compositionColors(concept));
  const colors = new Map(
    Object.entries(changes.colors).map(([from, to]) => [
      from.toLowerCase(),
      to,
    ]),
  );
  if ([...colors.keys()].some((from) => !available.has(from)))
    throw new Error(
      "A color changed in the source. Refresh the preview before refining.",
    );
  if (
    changes.symbolTint &&
    (concept.document.symbolSource !== "image" || !concept.cutout)
  )
    throw new Error(
      "Save a transparent image cutout before applying an exact symbol tint.",
    );
  const doc = structuredClone(concept.document);
  doc.primary = colors.get(doc.primary.toLowerCase()) ?? doc.primary;
  if (doc.symbolSource === "custom" && !doc.monochrome)
    doc.paths = doc.paths?.map((path) => ({
      ...path,
      fill: colors.get(path.fill.toLowerCase()) ?? path.fill,
    }));
  if (changes.background) doc.background = changes.background;
  if (changes.fontFamily) doc.fontFamily = changes.fontFamily;
  if (changes.symbolTint) doc.useCutout = true;
  return doc;
}
export function describeCompositionChanges(input: CompositionChanges): string {
  const changes = compositionChangesSchema.parse(input);
  return [
    ...Object.entries(changes.colors)
      .filter(([from, to]) => from.toLowerCase() !== to.toLowerCase())
      .map(([from, to]) => `${from} → ${to}`),
    changes.background ? `Background: ${changes.background}` : "",
    changes.fontFamily ? `Typeface: ${changes.fontFamily}` : "",
    changes.symbolTint ? `Cutout tint: ${changes.symbolTint}` : "",
  ]
    .filter(Boolean)
    .join("; ")
    .slice(0, 1500);
}
export function buildSymbolRefinementPrompt(instruction: string): string {
  const request = refinementInstructionSchema.parse(instruction);
  return `Edit the supplied logo symbol, using that image as the visual source. Preserve its recognizable identity and colors unless the requested change says otherwise. Requested change: ${request}. Return only the refined standalone symbol on a plain background. Do not add a wordmark, slogan, extra typography, mockup or watermark. If the reference symbol is a monogram, preserve that identity unless the request changes it. The studio retains the editable name and slogan separately. Preserve clean edges and a strong silhouette.`;
}
