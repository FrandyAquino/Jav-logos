import * as THREE from "three";
import { box, flatPrint, mesh, type SceneInput } from "./geometry";
import { surfaceMaterial } from "./materials";
function screenCanvas(input: SceneInput, phone: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = phone ? 720 : 1440;
  canvas.height = phone ? 1440 : 900;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f4f3ef";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const contain = (x: number, y: number, w: number, h: number) => {
    const scale = Math.min(w / input.artwork.width, h / input.artwork.height);
    const width = input.artwork.width * scale * input.settings.scale,
      height = input.artwork.height * scale * input.settings.scale;
    ctx.drawImage(
      input.artwork,
      x + (w - width) / 2 + input.settings.offsetX * w * 0.3,
      y + (h - height) / 2 - input.settings.offsetY * h * 0.3,
      width,
      height,
    );
  };
  ctx.fillStyle = "#1a2839";
  ctx.font = '500 24px "Google Sans Flex", sans-serif';
  if (phone) {
    ctx.fillText("9:41", 54, 65);
    ctx.fillStyle = "#e1e5e7";
    ctx.beginPath();
    ctx.roundRect(130, 400, 460, 460, 100);
    ctx.fill();
    contain(172, 442, 376, 376);
    ctx.fillStyle = "#1a2839";
    ctx.textAlign = "center";
    ctx.font = '500 38px "Google Sans Flex", sans-serif';
    ctx.fillText(input.brandName, 360, 940, 600);
    ctx.fillStyle = "#b7bfc4";
    ctx.beginPath();
    ctx.roundRect(265, 1360, 190, 8, 4);
    ctx.fill();
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 1440, 126);
    contain(54, 26, 210, 74);
    ctx.fillStyle = "#576270";
    ctx.textAlign = "right";
    ctx.fillText("About     Work     Contact", 1360, 76);
    ctx.fillStyle = "#1a2839";
    ctx.textAlign = "left";
    ctx.font = '500 68px "Google Sans Flex", sans-serif';
    ctx.fillText(input.brandName, 80, 290, 1280);
    ctx.fillStyle = "#d8dddf";
    ctx.fillRect(80, 340, 460, 6);
    ctx.fillRect(80, 365, 340, 6);
    ctx.fillStyle = input.primary;
    ctx.beginPath();
    ctx.roundRect(80, 420, 164, 52, 9);
    ctx.fill();
    contain(690, 240, 630, 460);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = ["#e6e1d8", "#dce3e4", "#e4e6dd"][i];
      ctx.beginPath();
      ctx.roundRect(80 + i * 440, 730, 405, 150, 12);
      ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return new THREE.MeshPhysicalMaterial({
    map: texture,
    emissiveMap: texture,
    emissive: "#ffffff",
    emissiveIntensity: 0.25,
    roughness: 0.3,
    clearcoat: 0.65,
    clearcoatRoughness: 0.18,
  });
}
export function digitalScene(input: SceneInput): THREE.Group {
  const root = new THREE.Group();
  const body = surfaceMaterial(input.settings.surface, "metal"),
    black = surfaceMaterial("#101419", "plastic");
  if (input.settings.scene === "web") {
    box(root, body, 1.95, 0.065, 1.3, [0, 0.045, 0], 0.025);
    const hinge = new THREE.Group();
    hinge.position.set(0, 0.095, -0.59);
    hinge.rotation.x = -0.19;
    root.add(hinge);
    box(hinge, body, 1.93, 1.24, 0.04, [0, 0.62, 0], 0.02);
    box(hinge, black, 1.85, 1.16, 0.01, [0, 0.62, 0.026], 0.008);
    mesh(
      new THREE.PlaneGeometry(1.76, 1.1),
      screenCanvas(input, false),
      hinge,
      [0, 0.63, 0.033],
    );
    const keys = new THREE.InstancedMesh(
        new THREE.BoxGeometry(0.11, 0.01, 0.095),
        black,
        60,
      ),
      matrix = new THREE.Matrix4();
    for (let row = 0; row < 5; row++)
      for (let col = 0; col < 12; col++) {
        matrix.makeTranslation((col - 5.5) * 0.14, 0.081, -0.34 + row * 0.115);
        keys.setMatrixAt(row * 12 + col, matrix);
      }
    keys.castShadow = true;
    root.add(keys);
    box(
      root,
      surfaceMaterial("#a3a8ad", "metal"),
      0.58,
      0.002,
      0.3,
      [0, 0.079, 0.4],
      0.001,
    );
  } else {
    const phone = new THREE.Group();
    root.add(phone);
    phone.rotation.x = -0.12;
    phone.position.y = 0.035;
    box(phone, body, 0.85, 1.73, 0.085, [0, 0.87, 0], 0.04);
    box(phone, black, 0.81, 1.68, 0.012, [0, 0.87, 0.046], 0.005);
    mesh(
      new THREE.PlaneGeometry(0.755, 1.51),
      screenCanvas(input, true),
      phone,
      [0, 0.86, 0.054],
    );
    box(phone, black, 0.24, 0.055, 0.006, [0, 1.6, 0.058], 0.002);
    box(root, body, 0.72, 0.055, 0.55, [0, 0.028, -0.1], 0.02);
  }
  return root;
}
export function signageScene(input: SceneInput): THREE.Group {
  const root = new THREE.Group(),
    metal = surfaceMaterial("#343c41", "metal");
  if (input.settings.scene === "sign") {
    const panel = surfaceMaterial(input.settings.surface, "ceramic");
    panel.roughness = 0.28;
    panel.clearcoat = 1;
    box(root, panel, 1.7, 1.08, 0.075, [0, 1.05, 0], 0.02);
    flatPrint(root, input, 1.25, 0.7, [0, 1.05, 0.04]);
    for (const x of [-0.74, 0.74])
      for (const y of [0.62, 1.48]) {
        const bolt = mesh(
          new THREE.CylinderGeometry(0.026, 0.026, 0.12, 24),
          metal,
          root,
          [x, y, -0.015],
        );
        bolt.rotation.x = Math.PI / 2;
      }
  } else {
    const panel = surfaceMaterial(input.settings.surface, "plastic");
    const ring = mesh(
      new THREE.CylinderGeometry(0.69, 0.69, 0.16, 96),
      metal,
      root,
      [0, 1.2, 0],
    );
    ring.rotation.x = Math.PI / 2;
    const face = mesh(
      new THREE.CircleGeometry(0.65, 96),
      panel,
      root,
      [0, 1.2, 0.082],
    );
    face.castShadow = false;
    flatPrint(root, input, 0.92, 0.92, [0, 1.2, 0.085]);
    box(root, metal, 0.05, 0.05, 0.45, [-0.48, 1.58, -0.22], 0.005);
    box(root, metal, 0.05, 0.05, 0.45, [-0.48, 0.82, -0.22], 0.005);
  }
  return root;
}
