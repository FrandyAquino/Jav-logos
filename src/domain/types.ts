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
export interface VectorDocument {
  shape: ShapeKind;
  text: string;
  primary: string;
  background: string;
  fontFamily: string;
  scale: number;
  rotation: number;
  letterSpacing: number;
  strokeWidth: number;
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
  reference?: string;
  tracedSvg?: string;
  generationContext?: {
    effectivePrompt: string;
    dna: BrandDna;
    width: number;
    height: number;
  };
  versions: ConceptVersion[];
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
