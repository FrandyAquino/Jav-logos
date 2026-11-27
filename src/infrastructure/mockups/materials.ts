import * as THREE from "three";
import type { MockupSettings } from "../../domain/mockups";
export function grainTexture(
  kind: "paper" | "cloth" | "plaster",
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const data = ctx.createImageData(256, 256);
  let seed = 918273;
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = (seed / 4294967296 - 0.5) * (kind === "plaster" ? 55 : 28);
      const weave =
        kind === "cloth"
          ? (Math.sin((x * Math.PI) / 2) + Math.sin((y * Math.PI) / 2)) * 22
          : 0;
      const value = Math.round(145 + noise + weave),
        offset = (y * 256 + x) * 4;
      data.data[offset] = data.data[offset + 1] = data.data[offset + 2] = value;
      data.data[offset + 3] = 255;
    }
  ctx.putImageData(data, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind === "cloth" ? 5 : 3, kind === "cloth" ? 5 : 3);
  return texture;
}
export function surfaceMaterial(
  color: string,
  kind: "paper" | "cloth" | "plaster" | "ceramic" | "metal" | "plastic",
) {
  const textured = ["paper", "cloth", "plaster"].includes(kind);
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness:
      kind === "ceramic"
        ? 0.22
        : kind === "metal"
          ? 0.35
          : kind === "plastic"
            ? 0.6
            : 0.92,
    metalness: kind === "metal" ? 0.7 : 0,
    clearcoat: kind === "ceramic" ? 0.7 : 0,
    clearcoatRoughness: 0.18,
    bumpMap: textured
      ? grainTexture(kind as "paper" | "cloth" | "plaster")
      : null,
    bumpScale: kind === "cloth" ? 0.012 : kind === "plaster" ? 0.025 : 0.004,
    sheen: kind === "cloth" ? 0.35 : 0,
    sheenColor: new THREE.Color(color),
    side: THREE.DoubleSide,
  });
}
export function printMaterial(
  artwork: HTMLCanvasElement,
  finish: MockupSettings["finish"],
) {
  const image = new THREE.CanvasTexture(artwork);
  image.colorSpace = THREE.SRGBColorSpace;
  image.anisotropy = 8;
  if (finish === "ink")
    return new THREE.MeshStandardMaterial({
      map: image,
      transparent: true,
      alphaTest: 0.02,
      depthWrite: false,
      roughness: 1,
      envMapIntensity: 0.15,
      side: THREE.DoubleSide,
    });
  const mask = document.createElement("canvas");
  mask.width = artwork.width;
  mask.height = artwork.height;
  const context = mask.getContext("2d")!;
  context.drawImage(artwork, 0, 0);
  const pixels = context.getImageData(0, 0, mask.width, mask.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const a = pixels.data[i + 3];
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = a;
    pixels.data[i + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  image.dispose();
  const alpha = new THREE.CanvasTexture(mask);
  alpha.anisotropy = 8;
  return new THREE.MeshStandardMaterial({
    color: "#c6a36a",
    alphaMap: alpha,
    transparent: true,
    alphaTest: 0.02,
    depthWrite: false,
    roughness: 0.26,
    metalness: 0.9,
    side: THREE.DoubleSide,
  });
}
