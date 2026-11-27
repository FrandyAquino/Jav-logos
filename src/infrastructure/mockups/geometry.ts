import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { MockupSettings } from "../../domain/mockups";
export interface SceneInput {
  settings: MockupSettings;
  artwork: HTMLCanvasElement;
  ink: THREE.Material;
  brandName: string;
  primary: string;
}
export function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  parent: THREE.Object3D,
  position: [number, number, number] = [0, 0, 0],
) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}
export function box(
  parent: THREE.Object3D,
  material: THREE.Material,
  width: number,
  height: number,
  depth: number,
  position: [number, number, number],
  radius = 0.02,
) {
  return mesh(
    new RoundedBoxGeometry(
      width,
      height,
      depth,
      3,
      Math.min(radius, width / 3, height / 3, depth / 3),
    ),
    material,
    parent,
    position,
  );
}
export function tube(
  parent: THREE.Object3D,
  material: THREE.Material,
  points: [number, number, number][],
  radius: number,
) {
  return mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
      48,
      radius,
      8,
      false,
    ),
    material,
    parent,
  );
}
export function fitArtwork(input: SceneInput, width: number, height: number) {
  const aspect = input.artwork.width / input.artwork.height;
  let w = width,
    h = width / aspect;
  if (h > height) {
    h = height;
    w = height * aspect;
  }
  return {
    width: w * input.settings.scale,
    height: h * input.settings.scale,
    x: input.settings.offsetX * width * 0.3,
    y: input.settings.offsetY * height * 0.3,
  };
}
export function flatPrint(
  parent: THREE.Object3D,
  input: SceneInput,
  width: number,
  height: number,
  position: [number, number, number],
  floor = false,
) {
  const size = fitArtwork(input, width, height);
  const print = mesh(
    new THREE.PlaneGeometry(size.width, size.height),
    input.ink,
    parent,
    position,
  );
  print.position.x += size.x;
  if (floor) {
    print.rotation.x = -Math.PI / 2;
    print.position.z -= size.y;
  } else print.position.y += size.y;
  print.castShadow = false;
  print.renderOrder = 3;
  return print;
}
export function curvedPrint(
  parent: THREE.Object3D,
  input: SceneInput,
  width: number,
  height: number,
  centerY: number,
  radiusAt: (y: number) => number,
) {
  const size = fitArtwork(input, width, height),
    columns = 40,
    rows = 12;
  const positions: number[] = [],
    normals: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  for (let row = 0; row <= rows; row++)
    for (let column = 0; column <= columns; column++) {
      const u = column / columns,
        v = row / rows,
        y = centerY + (v - 0.5) * size.height + size.y,
        r = radiusAt(y) + 0.002;
      const angle = ((u - 0.5) * size.width + size.x) / radiusAt(centerY);
      positions.push(Math.sin(angle) * r, y, Math.cos(angle) * r);
      normals.push(Math.sin(angle), 0, Math.cos(angle));
      uv.push(u, v);
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column;
        indices.push(
          a,
          a + 1,
          a + columns + 1,
          a + 1,
          a + columns + 2,
          a + columns + 1,
        );
      }
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  const print = mesh(geometry, input.ink, parent);
  print.castShadow = false;
  print.renderOrder = 3;
  return print;
}
export function lathe(
  parent: THREE.Object3D,
  material: THREE.Material,
  profile: [number, number][],
) {
  return mesh(
    new THREE.LatheGeometry(
      profile.map(([x, y]) => new THREE.Vector2(x, y)),
      96,
    ),
    material,
    parent,
  );
}
