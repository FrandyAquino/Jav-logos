import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  mockupScene,
  validateMockupSettings,
  type MockupCamera,
  type MockupSettings,
} from "../../domain/mockups";
import { paperScene } from "./paper-scenes";
import { merchScene } from "./merch-scenes";
import { digitalScene, signageScene } from "./digital-scenes";
import { printMaterial, surfaceMaterial } from "./materials";

let studioEnvironment: Promise<THREE.DataTexture> | undefined;
function studioTexture() {
  studioEnvironment ??= new HDRLoader().loadAsync(
    "/mockups/studio-small-09-1k.hdr",
  );
  studioEnvironment.catch(() => {
    studioEnvironment = undefined;
  });
  return studioEnvironment;
}
export interface MockupRenderInput {
  settings: MockupSettings;
  artwork: HTMLCanvasElement;
  brandName: string;
  primary: string;
}
function disposeTree(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>(),
    textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    const renderable = object as THREE.Mesh;
    if (renderable.geometry) geometries.add(renderable.geometry);
    for (const material of Array.isArray(renderable.material)
      ? renderable.material
      : renderable.material
        ? [renderable.material]
        : [])
      materials.add(material);
  });
  for (const material of materials)
    for (const value of Object.values(material))
      if (value instanceof THREE.Texture) textures.add(value);
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
}
export class MockupRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(32, 1.6, 0.01, 100);
  private readonly controls: OrbitControls;
  private environment: THREE.WebGLRenderTarget;
  readonly ready: Promise<void>;
  private readonly observer: ResizeObserver;
  private readonly floor: THREE.Mesh;
  private readonly wall: THREE.Mesh;
  private root: THREE.Group | null = null;
  private input: MockupRenderInput | null = null;
  private disposed = false;
  private frame: number | null = null;
  private renderDeadline: number | null = null;
  private capturing = false;
  private width = 800;
  private height = 500;
  private distance = 4;
  private center = new THREE.Vector3();
  private bounds = new THREE.Box3();
  private preset: MockupCamera = "studio";
  private readonly contextLost = (event: Event) => {
    event.preventDefault();
    this.onError(
      "The graphics context was lost. Retry the 3D preview after freeing GPU memory.",
    );
  };
  private readonly keyboard = (event: KeyboardEvent) => {
    if (this.disposed) return;
    if (
      ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    ) {
      event.preventDefault();
      const offset = this.camera.position.clone().sub(this.controls.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      if (event.key === "ArrowLeft") spherical.theta -= 0.12;
      if (event.key === "ArrowRight") spherical.theta += 0.12;
      if (event.key === "ArrowUp") spherical.phi -= 0.08;
      if (event.key === "ArrowDown") spherical.phi += 0.08;
      spherical.phi = THREE.MathUtils.clamp(
        spherical.phi,
        0.05,
        Math.PI / 2 - 0.02,
      );
      spherical.theta = THREE.MathUtils.clamp(
        spherical.theta,
        this.controls.minAzimuthAngle,
        this.controls.maxAzimuthAngle,
      );
      this.camera.position
        .copy(this.controls.target)
        .add(new THREE.Vector3().setFromSpherical(spherical));
      this.controls.update();
      this.requestRender();
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      this.zoom(1);
    } else if (event.key === "-") {
      event.preventDefault();
      this.zoom(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      this.setCamera(this.preset);
    }
  };
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onError: (message: string) => void,
  ) {
    const context = canvas.getContext("webgl2", {
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    if (!context)
      throw new Error(
        "3D mockups require WebGL 2. Your artwork is still available in the flat preview.",
      );
    if (!context.getExtension("EXT_color_buffer_float")) {
      context.getExtension("WEBGL_lose_context")?.loseContext();
      throw new Error(
        "This graphics device cannot render the studio materials. Flat artwork preview is available.",
      );
    }
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      context,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.VSMShadowMap;
    const environment = new RoomEnvironment(),
      pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environment = pmrem.fromScene(environment, 0.04);
    environment.dispose();
    pmrem.dispose();
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 0.35;
    const key = new THREE.DirectionalLight("#fff7e8", 2.3);
    key.position.set(-3, 5, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = key.shadow.camera.bottom = -4;
    key.shadow.camera.right = key.shadow.camera.top = 4;
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 15;
    key.shadow.normalBias = 0.008;
    key.shadow.bias = -0.00005;
    key.shadow.radius = 4;
    key.shadow.blurSamples = 8;
    this.scene.add(key, new THREE.HemisphereLight("#edf4ff", "#a59a87", 0.35));
    const rim = new THREE.DirectionalLight("#dce9ff", 0.65);
    rim.position.set(3, 3, -2);
    this.scene.add(rim);
    this.floor = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      surfaceMaterial("#ddd5c9", "plaster"),
    );
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);
    this.wall = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 30),
      surfaceMaterial("#d4cec3", "plaster"),
    );
    this.wall.position.set(0, 10, -0.48);
    this.wall.receiveShadow = true;
    this.scene.add(this.wall);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = false;
    this.controls.enablePan = false;
    // Keep wheel scrolling available to reach appearance controls below the canvas.
    this.controls.enableZoom = false;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    this.controls.minPolarAngle = 0.04;
    this.controls.addEventListener("change", this.requestRender);
    this.observer = new ResizeObserver(() => this.resize());
    if (canvas.parentElement) this.observer.observe(canvas.parentElement);
    canvas.addEventListener("webglcontextlost", this.contextLost);
    canvas.addEventListener("keydown", this.keyboard);
    this.resize();
    this.ready = this.loadStudioEnvironment();
  }
  private async loadStudioEnvironment() {
    try {
      const source = await studioTexture();
      if (this.disposed) return;
      const texture = source.clone();
      texture.needsUpdate = true;
      const generator = new THREE.PMREMGenerator(this.renderer);
      try {
        const environment = generator.fromEquirectangular(texture);
        this.scene.environment = environment.texture;
        this.scene.environmentIntensity = 0.65;
        this.environment.dispose();
        this.environment = environment;
        this.canvas.dataset.lighting = "hdr";
      } finally {
        texture.dispose();
        generator.dispose();
      }
    } catch {
      if (!this.disposed) this.canvas.dataset.lighting = "procedural";
    }
    this.requestRender();
  }
  private resize() {
    if (this.disposed || this.capturing) return;
    const bounds = this.canvas.parentElement?.getBoundingClientRect();
    if (!bounds?.width || !bounds.height) return;
    const factor = Math.min(1, 1400 / bounds.width);
    const nextWidth = Math.round(bounds.width * factor),
      nextHeight = Math.round(bounds.height * factor);
    const changed = nextWidth !== this.width || nextHeight !== this.height;
    this.width = nextWidth;
    this.height = nextHeight;
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    if (this.root && changed) {
      const offset = this.camera.position.clone().sub(this.controls.target);
      const zoom = offset.length() / this.distance;
      const direction = offset.normalize();
      this.distance = this.fittedDistance(direction);
      this.controls.minDistance = this.distance * 0.55;
      this.controls.maxDistance = this.distance * 1.9;
      this.camera.position
        .copy(this.controls.target)
        .add(direction.multiplyScalar(this.distance * zoom));
      this.controls.update();
    }
    this.requestRender();
  }
  private readonly requestRender = () => {
    if (this.disposed || this.capturing || !this.root || this.frame !== null)
      return;
    const render = () => {
      if (this.frame !== null) cancelAnimationFrame(this.frame);
      if (this.renderDeadline !== null) clearTimeout(this.renderDeadline);
      this.frame = null;
      this.renderDeadline = null;
      if (this.disposed || this.capturing) return;
      try {
        this.renderer.render(this.scene, this.camera);
        this.canvas.dataset.scene = this.input?.settings.scene ?? "";
      } catch (error) {
        this.onError(error instanceof Error ? error.message : String(error));
      }
    };
    this.frame = requestAnimationFrame(render);
    // WKWebView can suspend animation frames for an occluded native window.
    // Keep explicit scene/camera changes renderable without a continuous loop.
    this.renderDeadline = window.setTimeout(render, 100);
  };
  update(input: MockupRenderInput) {
    if (this.disposed) return;
    validateMockupSettings(input.settings);
    const reset = this.input?.settings.scene !== input.settings.scene;
    this.input = input;
    if (this.root) {
      this.scene.remove(this.root);
      disposeTree(this.root);
    }
    const category = mockupScene(input.settings.scene).category;
    const ink =
      category === "Digital"
        ? new THREE.MeshBasicMaterial()
        : printMaterial(input.artwork, input.settings.finish);
    const params = { ...input, ink };
    this.root =
      category === "Digital"
        ? digitalScene(params)
        : category === "Signage"
          ? signageScene(params)
          : ["card", "stationery", "package", "mailer", "bag"].includes(
                input.settings.scene,
              )
            ? paperScene(params)
            : merchScene(params);
    this.scene.add(this.root);
    // Digital screens use their own full-colour material, not the print material.
    if (category === "Digital") {
      for (const value of Object.values(ink))
        if (value instanceof THREE.Texture) value.dispose();
      ink.dispose();
    }
    const backgrounds = { warm: "#ded8ce", cool: "#d9e1e5", dark: "#28313b" };
    const color = backgrounds[input.settings.backdrop];
    this.scene.background = new THREE.Color(color);
    this.scene.fog = new THREE.Fog(color, 9, 25);
    (this.floor.material as THREE.MeshPhysicalMaterial).color.set(color);
    (this.wall.material as THREE.MeshPhysicalMaterial).color.set(color);
    this.wall.visible = category === "Signage";
    this.wall.position.z = input.settings.scene === "sign" ? -0.08 : -0.45;
    this.controls.minAzimuthAngle =
      category === "Signage" ? -Math.PI / 3 : -Infinity;
    this.controls.maxAzimuthAngle =
      category === "Signage" ? Math.PI / 3 : Infinity;
    this.bounds.setFromObject(this.root);
    if (reset) {
      this.bounds.getCenter(this.center);
      this.setCamera("studio");
    }
    this.requestRender();
  }
  private fittedDistance(direction: THREE.Vector3) {
    const right = new THREE.Vector3(0, 1, 0).cross(direction).normalize();
    const up = direction.clone().cross(right).normalize();
    const tangent = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    let distance = 0.8;
    for (const x of [this.bounds.min.x, this.bounds.max.x])
      for (const y of [this.bounds.min.y, this.bounds.max.y])
        for (const z of [this.bounds.min.z, this.bounds.max.z]) {
          const point = new THREE.Vector3(x, y, z).sub(this.center);
          distance = Math.max(
            distance,
            point.dot(direction) +
              Math.max(
                Math.abs(point.dot(right)) /
                  (tangent * this.camera.aspect * 0.84),
                Math.abs(point.dot(up)) / (tangent * 0.84),
              ),
          );
        }
    return distance;
  }
  setCamera(preset: MockupCamera) {
    if (!this.input || this.disposed) return;
    this.preset = preset;
    const flat = mockupScene(this.input.settings.scene).flat;
    const direction =
      preset === "overhead"
        ? new THREE.Vector3(0.01, 1, 0.01)
        : preset === "front"
          ? new THREE.Vector3(0, flat ? 1.25 : 0.12, 1)
          : new THREE.Vector3(
              flat ? 0.8 : 0.7,
              flat
                ? 1.3
                : ["package", "web"].includes(this.input.settings.scene)
                  ? 0.85
                  : 0.48,
              1.5,
            );
    direction.normalize();
    this.distance = this.fittedDistance(direction);
    this.controls.minDistance = this.distance * 0.55;
    this.controls.maxDistance = this.distance * 1.9;
    this.controls.target.copy(this.center);
    this.camera.position
      .copy(this.center)
      .add(direction.normalize().multiplyScalar(this.distance));
    this.controls.update();
    this.requestRender();
  }
  zoom(direction: number) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const distance = THREE.MathUtils.clamp(
      offset.length() * (direction > 0 ? 0.86 : 1.16),
      this.controls.minDistance,
      this.controls.maxDistance,
    );
    this.camera.position
      .copy(this.controls.target)
      .add(offset.setLength(distance));
    this.controls.update();
    this.requestRender();
  }
  async capturePng(): Promise<Uint8Array> {
    if (
      this.disposed ||
      this.renderer.getContext().isContextLost() ||
      !this.root ||
      this.capturing
    )
      throw new Error("Wait for the 3D preview before exporting.");
    this.capturing = true;
    const ratio = this.renderer.getPixelRatio();
    try {
      const factor = 2048 / Math.max(this.width, this.height);
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(
        Math.round(this.width * factor),
        Math.round(this.height * factor),
        false,
      );
      this.renderer.render(this.scene, this.camera);
      const blob = await new Promise<Blob>((resolve, reject) =>
        this.canvas.toBlob(
          (blob) =>
            blob
              ? resolve(blob)
              : reject(new Error("Mockup PNG encoding failed.")),
          "image/png",
        ),
      );
      return new Uint8Array(await blob.arrayBuffer());
    } finally {
      if (!this.disposed) {
        this.renderer.setPixelRatio(ratio);
        this.renderer.setSize(this.width, this.height, false);
        this.capturing = false;
        this.resize();
        this.requestRender();
      }
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    if (this.renderDeadline !== null) clearTimeout(this.renderDeadline);
    this.observer.disconnect();
    this.controls.removeEventListener("change", this.requestRender);
    this.controls.dispose();
    this.canvas.removeEventListener("webglcontextlost", this.contextLost);
    this.canvas.removeEventListener("keydown", this.keyboard);
    disposeTree(this.scene);
    this.environment.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
