import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  box,
  curvedPrint,
  fitArtwork,
  lathe,
  mesh,
  tube,
  type SceneInput,
} from "./geometry";
import { surfaceMaterial } from "./materials";
function foldedPlane(
  width: number,
  height: number,
  fold: (x: number, y: number) => number,
) {
  const geometry = new THREE.PlaneGeometry(width, height, 64, 48),
    position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i++)
    position.setZ(i, fold(position.getX(i), position.getY(i)));
  geometry.computeVertexNormals();
  return geometry;
}
export function merchScene(input: SceneInput): THREE.Group {
  const root = new THREE.Group(),
    id = input.settings.scene;
  if (id === "mug") {
    const ceramic = surfaceMaterial(input.settings.surface, "ceramic");
    lathe(root, ceramic, [
      [0, 0.04],
      [0.32, 0.04],
      [0.4, 0.07],
      [0.43, 0.13],
      [0.44, 0.9],
      [0.435, 0.94],
      [0.405, 0.94],
      [0.395, 0.9],
      [0.38, 0.16],
      [0.32, 0.12],
      [0, 0.12],
    ]);
    const handle = mesh(
      new THREE.TorusGeometry(0.29, 0.075, 20, 64),
      ceramic,
      root,
      [0.47, 0.51, 0],
    );
    handle.scale.x = 0.85;
    curvedPrint(
      root,
      input,
      0.64,
      0.45,
      0.51,
      (y) => 0.43 + ((y - 0.13) * 0.01) / 0.77,
    );
  } else if (id === "bottle") {
    const body = surfaceMaterial(input.settings.surface, "metal");
    body.metalness = 0.3;
    body.roughness = 0.45;
    lathe(root, body, [
      [0, 0],
      [0.28, 0],
      [0.35, 0.04],
      [0.375, 0.13],
      [0.375, 1.26],
      [0.35, 1.4],
      [0.23, 1.52],
      [0.22, 1.68],
      [0, 1.68],
    ]);
    const cap = surfaceMaterial("#30363b", "plastic");
    mesh(
      new THREE.CylinderGeometry(0.238, 0.238, 0.21, 64),
      cap,
      root,
      [0, 1.65, 0],
    );
    for (let y = 1.57; y < 1.74; y += 0.027) {
      const rib = mesh(
        new THREE.TorusGeometry(0.239, 0.004, 6, 64),
        cap,
        root,
        [0, y, 0],
      );
      rib.rotation.x = Math.PI / 2;
    }
    curvedPrint(root, input, 0.55, 0.68, 0.79, () => 0.375);
  } else if (id === "cup") {
    const paper = surfaceMaterial(input.settings.surface, "paper");
    lathe(root, paper, [
      [0, 0.02],
      [0.29, 0.02],
      [0.31, 0.06],
      [0.43, 0.88],
      [0.435, 0.93],
      [0.405, 0.93],
      [0.28, 0.08],
      [0, 0.08],
    ]);
    const lid = surfaceMaterial("#27292b", "plastic");
    lathe(root, lid, [
      [0, 0.925],
      [0.46, 0.925],
      [0.47, 0.95],
      [0.47, 0.99],
      [0.43, 1],
      [0.42, 1.07],
      [0.36, 1.085],
      [0, 1.085],
    ]);
    const sip = mesh(
      new THREE.BoxGeometry(0.12, 0.003, 0.045),
      new THREE.MeshStandardMaterial({ color: "#080909", roughness: 1 }),
      root,
      [0, 1.087, 0.29],
    );
    sip.castShadow = false;
    curvedPrint(
      root,
      input,
      0.58,
      0.42,
      0.51,
      (y) => 0.31 + ((y - 0.06) * 0.12) / 0.82,
    );
  } else if (id === "tote") {
    const fabric = surfaceMaterial(input.settings.surface, "cloth");
    box(root, fabric, 1.12, 1.25, 0.15, [0, 0.65, 0], 0.06);
    const fold = (x: number, y: number) =>
      0.095 +
      0.013 * Math.sin(x * 12 + y * 2) +
      0.007 * Math.cos(y * 13 - x * 3);
    mesh(foldedPlane(1.1, 1.22, fold), fabric, root, [0, 0.65, 0]);
    const size = fitArtwork(input, 0.76, 0.65);
    const artFold = (x: number, y: number) =>
      fold(x + size.x, y + size.y) + 0.002;
    const print = mesh(
      foldedPlane(size.width, size.height, artFold),
      input.ink,
      root,
      [size.x, 0.65 + size.y, 0],
    );
    print.castShadow = false;
    print.renderOrder = 3;
    const strap = new THREE.Shape();
    strap.moveTo(-0.04, -0.006);
    strap.lineTo(0.04, -0.006);
    strap.lineTo(0.04, 0.006);
    strap.lineTo(-0.04, 0.006);
    strap.closePath();
    for (const z of [-0.06, 0.07]) {
      const curve = new THREE.CatmullRomCurve3(
        [
          [-0.32, 1.2, z],
          [-0.28, 1.85, z],
          [0, 1.97, z],
          [0.28, 1.85, z],
          [0.32, 1.2, z],
        ].map(
          (point) => new THREE.Vector3(...(point as [number, number, number])),
        ),
      );
      mesh(
        new THREE.ExtrudeGeometry(strap, {
          steps: 64,
          bevelEnabled: false,
          extrudePath: curve,
        }),
        fabric,
        root,
      );
    }
    const seam = surfaceMaterial(
      new THREE.Color(input.settings.surface).multiplyScalar(0.85).getStyle(),
      "cloth",
    );
    tube(
      root,
      seam,
      [
        [-0.51, 1.2, 0.104],
        [-0.51, 0.1, 0.104],
        [0.51, 0.1, 0.104],
        [0.51, 1.2, 0.104],
      ],
      0.0025,
    );
  } else {
    const fabric = surfaceMaterial(input.settings.surface, "cloth");
    const shade = surfaceMaterial(
      new THREE.Color(input.settings.surface).multiplyScalar(0.86).getStyle(),
      "cloth",
    );
    const shirt = new THREE.Group();
    root.add(shirt);
    shirt.rotation.y = -0.12;
    const fold = (x: number, z: number) =>
      (0.012 * Math.sin(x * 7 + z * 3) + 0.006 * Math.cos(z * 8)) *
      Math.max(0, 1 - Math.abs(x) / 0.6);
    const shape = new RoundedBoxGeometry(1.13, 0.14, 1.42, 8, 0.04);
    const vertices = shape.getAttribute("position");
    for (let i = 0; i < vertices.count; i++)
      vertices.setY(
        i,
        vertices.getY(i) +
          fold(vertices.getX(i), vertices.getZ(i)) *
            Math.max(0, (vertices.getY(i) + 0.07) / 0.14),
      );
    shape.computeVertexNormals();
    mesh(shape, fabric, shirt, [0, 0.095, 0]);
    box(shirt, shade, 1.08, 0.035, 1.38, [0, 0.025, 0.012], 0.017);
    for (const side of [-1, 1]) {
      const sleeve = box(
        shirt,
        fabric,
        0.38,
        0.035,
        0.58,
        [side * 0.5, 0.04, -0.35],
        0.017,
      );
      sleeve.rotation.y = side * 0.25;
    }
    const opening = mesh(
      new THREE.CircleGeometry(0.15, 48),
      surfaceMaterial(
        new THREE.Color(input.settings.surface).multiplyScalar(0.35).getStyle(),
        "cloth",
      ),
      shirt,
      [0, 0.181, -0.5],
    );
    opening.rotation.x = -Math.PI / 2;
    opening.scale.y = 0.65;
    const collar = mesh(
      new THREE.TorusGeometry(0.17, 0.015, 12, 64),
      fabric,
      shirt,
      [0, 0.184, -0.5],
    );
    collar.rotation.x = -Math.PI / 2;
    collar.scale.y = 0.65;
    const size = fitArtwork(input, 0.75, 0.64);
    const printGeometry = new THREE.PlaneGeometry(
      size.width,
      size.height,
      64,
      48,
    );
    const points = printGeometry.getAttribute("position");
    for (let i = 0; i < points.count; i++) {
      const x = points.getX(i) + size.x,
        z = 0.08 - points.getY(i) - size.y;
      points.setXYZ(i, x, 0.168 + fold(x, z), z);
    }
    printGeometry.computeVertexNormals();
    const print = mesh(printGeometry, input.ink, shirt);
    print.castShadow = false;
    print.renderOrder = 3;
  }
  return root;
}
