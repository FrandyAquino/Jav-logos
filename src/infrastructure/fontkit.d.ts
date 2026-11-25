declare module "fontkit" {
  export interface Font {
    unitsPerEm: number;
    ascent: number;
    descent: number;
    xHeight: number;
    variationAxes: Record<
      string,
      { min: number; max: number; default: number }
    >;
    hasGlyphForCodePoint(code: number): boolean;
    getVariation(axes: Record<string, number>): Font;
    layout(
      text: string,
      features?: Record<string, boolean>,
    ): {
      glyphs: {
        id: number;
        path: { toSVG(): string };
        bbox: { minX: number; minY: number; maxX: number; maxY: number };
      }[];
      positions: {
        xAdvance: number;
        yAdvance: number;
        xOffset: number;
        yOffset: number;
      }[];
    };
  }
  export function create(buffer: Uint8Array): Font;
}
