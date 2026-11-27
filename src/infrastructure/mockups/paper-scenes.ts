import * as THREE from "three";
import { box, flatPrint, mesh, tube, type SceneInput } from "./geometry";
import { surfaceMaterial } from "./materials";
export function paperScene(input: SceneInput): THREE.Group {
  const root = new THREE.Group(),
    id = input.settings.scene;
  const paper = surfaceMaterial(input.settings.surface, "paper");
  const dark = surfaceMaterial(
    new THREE.Color(input.primary).multiplyScalar(0.4).getStyle(),
    "paper",
  );
  if (id === "card") {
    const back = new THREE.Group();
    root.add(back);
    back.position.set(-0.3, 0.02, -0.3);
    back.rotation.y = -0.28;
    for (let i = 0; i < 5; i++)
      box(back, dark, 1.65, 0.008, 0.96, [i * 0.002, i * 0.009, 0], 0.003);
    const front = new THREE.Group();
    root.add(front);
    front.position.set(0.3, 0.08, 0.28);
    front.rotation.y = 0.16;
    box(front, paper, 1.65, 0.022, 0.96, [0, 0, 0], 0.005);
    flatPrint(front, input, 1.17, 0.65, [0, 0.013, 0], true);
  } else if (id === "stationery") {
    const letter = new THREE.Group();
    root.add(letter);
    letter.rotation.y = -0.15;
    letter.position.set(-0.36, 0.023, -0.05);
    box(letter, paper, 1.25, 0.008, 1.77, [0, 0, 0], 0.002);
    flatPrint(letter, input, 0.65, 0.36, [0, 0.006, -0.5], true);
    const ruleMat = new THREE.MeshStandardMaterial({
      color: input.primary,
      roughness: 1,
    });
    box(letter, ruleMat, 0.96, 0.001, 0.004, [0, 0.006, 0.58], 0);
    const envelope = new THREE.Group();
    root.add(envelope);
    envelope.position.set(0.62, 0.027, 0.45);
    envelope.rotation.y = 0.19;
    box(envelope, dark, 1.08, 0.016, 0.55, [0, 0, 0], 0.004);
    const seam = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.5, 0.01, -0.22),
        new THREE.Vector3(0, 0.01, 0.15),
        new THREE.Vector3(0.5, 0.01, -0.22),
      ]),
      new THREE.LineBasicMaterial({
        color: "#faf5e9",
        transparent: true,
        opacity: 0.35,
      }),
    );
    envelope.add(seam);
    const pencil = mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 1.25, 8),
      surfaceMaterial("#303842", "plastic"),
      root,
      [0.9, 0.035, -0.35],
    );
    pencil.rotation.z = Math.PI / 2;
    pencil.rotation.y = -1.1;
  } else if (id === "package") {
    const group = new THREE.Group();
    root.add(group);
    group.rotation.y = -0.23;
    box(group, paper, 1.48, 0.74, 1.12, [0, 0.38, 0], 0.025);
    box(group, dark, 1.49, 0.018, 1.13, [0, 0.73, 0], 0.005);
    box(group, paper, 1.55, 0.14, 1.19, [0, 0.82, 0], 0.018);
    flatPrint(group, input, 1.07, 0.76, [0, 0.892, 0], true);
    flatPrint(group, input, 0.45, 0.25, [0, 0.36, 0.562]);
  } else if (id === "mailer") {
    const group = new THREE.Group();
    root.add(group);
    group.rotation.y = 0.17;
    box(group, paper, 1.8, 0.4, 1.28, [0, 0.21, 0], 0.025);
    const edge = surfaceMaterial(
      new THREE.Color(input.settings.surface).multiplyScalar(0.7).getStyle(),
      "paper",
    );
    box(group, edge, 1.81, 0.012, 1.29, [0, 0.409, 0], 0.003);
    box(group, paper, 1.82, 0.036, 1.3, [0, 0.435, 0], 0.01);
    box(group, edge, 0.38, 0.045, 0.012, [0, 0.37, 0.645], 0.004);
    flatPrint(group, input, 1.2, 0.85, [0, 0.455, 0], true);
  } else {
    // Open paper bag: actual front/back/side panels and cord handles.
    mesh(new THREE.PlaneGeometry(1.1, 1.25), paper, root, [0, 0.625, 0.2]);
    const back = mesh(
      new THREE.PlaneGeometry(1.1, 1.25),
      paper,
      root,
      [0, 0.625, -0.2],
    );
    back.rotation.y = Math.PI;
    for (const side of [-1, 1]) {
      const panel = mesh(new THREE.PlaneGeometry(0.4, 1.25), paper, root, [
        side * 0.55,
        0.625,
        0,
      ]);
      panel.rotation.y = (side * Math.PI) / 2;
    }
    const bottom = mesh(
      new THREE.PlaneGeometry(1.1, 0.4),
      paper,
      root,
      [0, 0.004, 0],
    );
    bottom.rotation.x = -Math.PI / 2;
    const cord = surfaceMaterial("#36332c", "cloth");
    for (const z of [-0.2, 0.2])
      tube(
        root,
        cord,
        [
          [-0.29, 1.18, z],
          [-0.29, 1.68, z],
          [0, 1.82, z],
          [0.29, 1.68, z],
          [0.29, 1.18, z],
        ],
        0.018,
      );
    flatPrint(root, input, 0.76, 0.63, [0, 0.64, 0.203]);
    for (const x of [-0.29, 0.29]) {
      const hole = mesh(new THREE.CircleGeometry(0.026, 24), dark, root, [
        x,
        1.18,
        0.204,
      ]);
      hole.castShadow = false;
    }
    root.rotation.y = -0.12;
  }
  return root;
}
