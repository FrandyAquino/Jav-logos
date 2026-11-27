export const MOCKUP_SCENES = [
  {
    id: "card",
    name: "Business cards",
    category: "Print",
    material: "Cotton paper",
    flat: true,
    color: "#f3eee4",
  },
  {
    id: "stationery",
    name: "Stationery",
    category: "Print",
    material: "Paper & envelope",
    flat: true,
    color: "#f7f4ed",
  },
  {
    id: "package",
    name: "Rigid box",
    category: "Packaging",
    material: "Matte board",
    flat: false,
    color: "#e9e5dc",
  },
  {
    id: "mailer",
    name: "Kraft mailer",
    category: "Packaging",
    material: "Kraft cardboard",
    flat: true,
    color: "#b88f60",
  },
  {
    id: "bag",
    name: "Shopping bag",
    category: "Packaging",
    material: "Paper & cord",
    flat: false,
    color: "#e9e2d1",
  },
  {
    id: "tote",
    name: "Cotton tote",
    category: "Merch",
    material: "Woven canvas",
    flat: false,
    color: "#dfd4bd",
  },
  {
    id: "shirt",
    name: "Folded T-shirt",
    category: "Merch",
    material: "Cotton jersey",
    flat: true,
    color: "#343d45",
  },
  {
    id: "mug",
    name: "Ceramic mug",
    category: "Merch",
    material: "Glazed ceramic",
    flat: false,
    color: "#e8e6df",
  },
  {
    id: "bottle",
    name: "Water bottle",
    category: "Merch",
    material: "Coated aluminium",
    flat: false,
    color: "#d6ddd7",
  },
  {
    id: "cup",
    name: "Takeaway cup",
    category: "Packaging",
    material: "Kraft & soft-touch lid",
    flat: false,
    color: "#c5a378",
  },
  {
    id: "sign",
    name: "Office plaque",
    category: "Signage",
    material: "Acrylic & steel",
    flat: false,
    color: "#ecebe5",
  },
  {
    id: "round-sign",
    name: "Shop sign",
    category: "Signage",
    material: "Powder-coated metal",
    flat: false,
    color: "#f1eee7",
  },
  {
    id: "web",
    name: "Laptop",
    category: "Digital",
    material: "Aluminium & glass",
    flat: false,
    color: "#b9bdc2",
  },
  {
    id: "app",
    name: "Phone",
    category: "Digital",
    material: "Glass & anodised metal",
    flat: false,
    color: "#3e4650",
  },
] as const;
export type MockupSceneId = (typeof MOCKUP_SCENES)[number]["id"];
export type MockupSource = "composition" | "symbol" | "original" | "cutout";
export type MockupCamera = "studio" | "front" | "overhead";
export interface MockupSettings {
  scene: MockupSceneId;
  surface: string;
  backdrop: "warm" | "cool" | "dark";
  finish: "ink" | "foil";
  scale: number;
  offsetX: number;
  offsetY: number;
}
export function mockupScene(id: string) {
  const scene = MOCKUP_SCENES.find((scene) => scene.id === id);
  if (!scene) throw new Error("Unknown mockup scene.");
  return scene;
}
export function validateMockupSettings(settings: MockupSettings) {
  mockupScene(settings.scene);
  if (
    !/^#[a-f\d]{6}$/i.test(settings.surface) ||
    !["warm", "cool", "dark"].includes(settings.backdrop) ||
    !["ink", "foil"].includes(settings.finish) ||
    !Number.isFinite(settings.scale) ||
    settings.scale < 0.55 ||
    settings.scale > 1.15 ||
    [settings.offsetX, settings.offsetY].some(
      (value) => !Number.isFinite(value) || Math.abs(value) > 0.25,
    )
  )
    throw new Error("Invalid mockup settings.");
}
