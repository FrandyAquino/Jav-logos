import type { Brand, BrandDna, VectorDocument } from "./types";
import fontFamilies from "../../shared/font-families.json";
export const DEFAULT_DNA: BrandDna = {
  palette: ["#7775E7", "#202430", "#F6F5F1"],
  typography: "Avenir Next",
  geometry: "orbit",
  tone: "Precise, confident, imaginative",
};
export const FONTS = fontFamilies;
export function validateHierarchy(brands: Brand[]): void {
  const map = new Map(brands.map((b) => [b.id, b]));
  if (map.size !== brands.length) throw new Error("Duplicate brand identity.");
  for (const brand of brands) {
    const visited = new Set<string>();
    let current: Brand | undefined = brand;
    while (current) {
      if (visited.has(current.id))
        throw new Error("Brand hierarchy contains a cycle.");
      visited.add(current.id);
      const parent: string | null = current.parentId;
      if (parent && !map.has(parent))
        throw new Error("Brand parent is missing.");
      current = parent ? map.get(parent) : undefined;
    }
  }
}
export function resolveDna(brandId: string, brands: Brand[]): BrandDna {
  validateHierarchy(brands);
  const chain: Brand[] = [];
  let brand = brands.find((b) => b.id === brandId);
  if (!brand) throw new Error("Brand not found.");
  while (brand) {
    chain.unshift(brand);
    brand = brands.find((b) => b.id === brand?.parentId);
  }
  return chain.reduce<BrandDna>((dna, node) => ({ ...dna, ...node.dna }), {
    ...DEFAULT_DNA,
    palette: [...DEFAULT_DNA.palette],
  });
}
export function analyzeConsistency(
  brandId: string,
  brands: Brand[],
  document: VectorDocument,
): { score: number; issues: string[] } {
  const dna = resolveDna(brandId, brands);
  const issues: string[] = [];
  if (
    !dna.palette.some((c) => c.toLowerCase() === document.primary.toLowerCase())
  )
    issues.push("Primary color is outside the inherited palette.");
  if (dna.typography !== document.fontFamily)
    issues.push("Typography differs from Brand DNA.");
  if (dna.geometry !== document.shape)
    issues.push("Geometry explores a different family.");
  return { score: Math.max(0, 100 - issues.length * 25), issues };
}
export function buildPrompt(
  prompt: string,
  name: string,
  dna: BrandDna,
): string {
  return `Professional logo concept for ${name}. ${prompt}. Brand character: ${dna.tone}. Palette: ${dna.palette.join(", ")}. Geometric language: ${dna.geometry}. Clean isolated mark, strong silhouette, flat colors, plain background, no mockup, no watermark.`;
}
