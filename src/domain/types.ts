export type ShapeKind =
  "orbit" | "petal" | "monogram" | "prism" | "wave" | "grid";
export interface BrandDna {
  palette: string[];
  typography: string;
  geometry: ShapeKind;
  tone: string;
}
export interface Brand {
  id: string;
  name: string;
  parentId: string | null;
  dna: Partial<BrandDna>;
  createdAt: string;
  book?: {
    headline?: string;
    overview?: string;
    usageNotes?: string;
    voice?: string;
  };
  status?: "active" | "completed" | "archived";
  pinned?: boolean;
  order?: number;
  icon?:
    | "diamond"
    | "orbit"
    | "flower"
    | "type"
    | "triangle"
    | "waves"
    | "grid"
    | "layers"
    | "spark";
}
export interface VectorNode {
  id: string;
  x: number;
  y: number;
  inX?: number;
  inY?: number;
  outX?: number;
  outY?: number;
}
export interface VectorContour {
  nodes: VectorNode[];
  closed: boolean;
}
export interface VectorPath {
  id: string;
  fill: string;
  fillRule?: "nonzero" | "evenodd";
  contours: VectorContour[];
}
export interface VectorDocument {
  shape: ShapeKind;
  text: string;
  primary: string;
  background: string;
  transparentBackground?: boolean;
  autoFitText?: boolean;
  wordmarkFit?: number;
  sloganFit?: number;
  useCutout?: boolean;
  fontFamily: string;
  scale: number;
  rotation: number;
  letterSpacing: number;
  strokeWidth: number;
  layout?: "stacked" | "horizontal" | "symbol" | "wordmark";
  slogan?: string;
  symbolSource?: "geometric" | "image" | "trace" | "custom";
  showSymbol?: boolean;
  showWordmark?: boolean;
  showSlogan?: boolean;
  monochrome?: boolean;
  wordmarkSize?: number;
  sloganSize?: number;
  symbolOffsetX?: number;
  symbolOffsetY?: number;
  wordmarkOffsetX?: number;
  wordmarkOffsetY?: number;
  sloganOffsetX?: number;
  sloganOffsetY?: number;
  paths?: VectorPath[];
  motion?: "none" | "fade" | "assemble" | "draw";
}
export interface ConceptVersion {
  id: string;
  createdAt: string;
  document: VectorDocument;
}
export interface Concept {
  id: string;
  brandId: string;
  name: string;
  prompt: string;
  provider: string;
  seed: number;
  createdAt: string;
  document: VectorDocument;
  raster?: string;
  cutout?: string;
  derivedFrom?: string;
  refinement?: {
    kind: "composition" | "ai";
    instruction: string;
    before: string;
  };
  reference?: string;
  tracedSvg?: string;
  generationContext?: {
    effectivePrompt: string;
    dna: BrandDna;
    width: number;
    height: number;
  };
  versions: ConceptVersion[];
  favorite?: boolean;
  notes?: string;
}
export interface Workspace {
  schemaVersion: 1;
  revision: number;
  brands: Brand[];
  concepts: Concept[];
}
export interface ProviderHealth {
  available: boolean;
  provider: string;
  message: string;
}
export interface GenerationRequest {
  jobId: string;
  prompt: string;
  seed: number;
  count: number;
  width: number;
  height: number;
  referenceBase64?: string;
}
export interface GenerationResult {
  images: { pngBase64: string; seed: number }[];
  provider: string;
}
export interface GenerationProgress {
  jobId: string;
  phase:
    | "starting"
    | "loading"
    | "encoding"
    | "sampling"
    | "decoding"
    | "image-ready"
    | "saving"
    | "completed"
    | "cancelled"
    | "failed";
  message: string;
  imageIndex: number;
  imageCount: number;
  step?: number;
  steps?: number;
  updatedAt: number;
  logs: { at: number; message: string }[];
  previewBase64?: string;
}
