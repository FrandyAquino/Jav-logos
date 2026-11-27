import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  CreditCard,
  Download,
  Laptop,
  Maximize,
  Minus,
  Plus,
  Shirt,
  ShoppingBag,
  Smartphone,
  Coffee,
  Wine,
  FileText,
  Store,
} from "lucide-react";
import {
  MOCKUP_SCENES,
  mockupScene,
  type MockupCamera,
  type MockupSceneId,
  type MockupSettings,
  type MockupSource,
} from "../../domain/mockups";
import { prepareMockupArtwork } from "../../infrastructure/mockups/artwork";
import type {
  MockupRenderer,
  MockupRenderInput,
} from "../../infrastructure/mockups/renderer";
import { MockupStage } from "./mockup-stage";
import { BackgroundDialog } from "../preparation-dialogs";
import { MockupAppearanceControls } from "./mockup-appearance-controls";
import type { StudioState } from "../ui";
import { ViewEmpty, ViewHeading } from "./view-primitives";
import "./mockups.css";
export type MockupTemplate = MockupSceneId;
const icons = {
  card: CreditCard,
  stationery: FileText,
  package: Box,
  mailer: Box,
  bag: ShoppingBag,
  tote: ShoppingBag,
  shirt: Shirt,
  mug: Coffee,
  bottle: Wine,
  cup: Coffee,
  sign: Store,
  "round-sign": Store,
  web: Laptop,
  app: Smartphone,
};
const defaults: MockupSettings = {
  scene: "card",
  surface: MOCKUP_SCENES[0].color,
  backdrop: "warm",
  finish: "ink",
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};
export function MockupView({ studio }: { studio: StudioState }) {
  const [settings, setSettings] = useState<MockupSettings>(defaults);
  const [category, setCategory] = useState("All");
  const [source, setSource] = useState<MockupSource>("composition");
  const [includeBackground, setIncludeBackground] = useState(false);
  const [cutoutDialog, setCutoutDialog] = useState<string | null>(null);
  const [artifact, setArtifact] = useState<{
    key: string;
    canvas: HTMLCanvasElement;
  }>();
  const [error, setError] = useState<{ key: string; message: string }>();
  const [ready, setReady] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const settingsPanel = useRef<HTMLFieldSetElement>(null);
  const exportLock = useRef(false),
    controller = useRef<MockupRenderer | null>(null);
  const concept = studio.selectedConcept,
    brand = studio.selectedBrand;
  const effectiveSource: MockupSource =
    (source === "original" && !concept?.raster) ||
    (source === "cutout" && !concept?.cutout)
      ? "composition"
      : source;
  const key = useMemo(
    () =>
      JSON.stringify([
        concept?.id,
        concept?.document,
        concept?.raster,
        concept?.cutout,
        concept?.tracedSvg,
        effectiveSource,
        includeBackground,
      ]),
    [concept, effectiveSource, includeBackground],
  );
  useEffect(() => {
    let active = true;
    if (!concept) return;
    void prepareMockupArtwork(concept, effectiveSource, includeBackground)
      .then((canvas) => {
        if (active) {
          setArtifact({ key, canvas });
          setError(undefined);
        }
      })
      .catch((error) => {
        if (active)
          setError({
            key,
            message: error instanceof Error ? error.message : String(error),
          });
      });
    return () => {
      active = false;
    };
  }, [concept, effectiveSource, includeBackground, key]);
  const scene = mockupScene(settings.scene),
    digital = scene.category === "Digital";
  const input = useMemo<MockupRenderInput | null>(
    () =>
      artifact && brand && concept
        ? {
            settings,
            artwork: artifact.canvas,
            brandName: brand.name,
            primary: concept.document.primary,
          }
        : null,
    [artifact, settings, brand, concept],
  );
  const liveInput = useRef(input);
  liveInput.current = input;
  const current = artifact?.key === key && error?.key !== key;
  const update = (patch: Partial<MockupSettings>) =>
    setSettings((value) => ({ ...value, ...patch }));
  const camera = (value: MockupCamera) => controller.current?.setCamera(value);
  const options = [
    { value: "composition", label: "Editable composition" },
    { value: "symbol", label: "Symbol only" },
    ...(concept?.raster
      ? [{ value: "original", label: "Original image" }]
      : []),
    ...(concept?.cutout
      ? [{ value: "cutout", label: "Transparent cutout" }]
      : []),
  ];
  return (
    <section
      className="exploration-view mockup-view"
      aria-label="Brand applications"
    >
      <ViewHeading
        title="Mockup studio"
        description="Your identity on physical materials, with studio lighting and real perspective."
      >
        <button
          type="button"
          className="primary-button"
          disabled={!ready || !current || exporting || studio.busy}
          onClick={async () => {
            if (
              exportLock.current ||
              !controller.current ||
              !input ||
              !brand ||
              !concept ||
              !current
            )
              return;
            exportLock.current = true;
            setExporting(true);
            setExportError("");
            const conceptId = concept.id,
              sceneId = settings.scene;
            const capturedSettings = { ...settings },
              capturedSource = effectiveSource,
              capturedBackground = includeBackground;
            try {
              await studio.exportMockup(
                conceptId,
                sceneId,
                async (latestConcept, latestBrand) => {
                  const artwork = await prepareMockupArtwork(
                    latestConcept,
                    capturedSource,
                    capturedBackground,
                  );
                  const stage = controller.current;
                  if (!stage)
                    throw new Error(
                      "The mockup view was closed. Reopen it to export.",
                    );
                  stage.update({
                    settings: capturedSettings,
                    artwork,
                    brandName: latestBrand.name,
                    primary: latestConcept.document.primary,
                  });
                  try {
                    return await stage.capturePng();
                  } finally {
                    if (controller.current === stage && liveInput.current)
                      stage.update(liveInput.current);
                  }
                },
              );
            } catch (error) {
              setExportError(
                error instanceof Error ? error.message : String(error),
              );
            } finally {
              exportLock.current = false;
              setExporting(false);
            }
          }}
        >
          <Download size={14} />
          {exporting ? "Exporting…" : "Export mockup PNG"}
        </button>
      </ViewHeading>
      {!brand || !concept ? (
        <ViewEmpty title="Select a concept">
          Choose a saved logo to preview its applications.
        </ViewEmpty>
      ) : (
        <>
          <div
            className="mockup-category-bar"
            role="group"
            aria-label="Mockup categories"
          >
            {["All", "Print", "Packaging", "Merch", "Signage", "Digital"].map(
              (item) => (
                <button
                  type="button"
                  key={item}
                  aria-pressed={category === item}
                  disabled={exporting}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ),
            )}
            <span>{MOCKUP_SCENES.length} scenes</span>
          </div>
          <div
            className="mockup-catalog"
            role="group"
            aria-label="Application template"
          >
            {MOCKUP_SCENES.filter(
              (item) => category === "All" || item.category === category,
            ).map((item) => {
              const Icon = icons[item.id];
              return (
                <button
                  type="button"
                  key={item.id}
                  className="mockup-scene-button"
                  aria-pressed={settings.scene === item.id}
                  disabled={exporting}
                  onClick={() =>
                    setSettings((value) => ({
                      ...value,
                      scene: item.id,
                      surface: item.color,
                      offsetX: 0,
                      offsetY: 0,
                    }))
                  }
                >
                  <Icon size={20} />
                  <span>
                    {item.name}
                    <small>{item.material}</small>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mockup-studio-toolbar">
            <div>
              <strong>{scene.name}</strong>
              <span>{scene.material}</span>
            </div>
            <div role="group" aria-label="Camera presets">
              <button
                type="button"
                className="subtle-button"
                disabled={!ready || exporting}
                onClick={() => camera("studio")}
              >
                Studio
              </button>
              <button
                type="button"
                className="subtle-button"
                disabled={!ready || exporting}
                onClick={() => camera(scene.flat ? "overhead" : "front")}
              >
                {scene.flat ? "Top view" : "Front"}
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label="Zoom out mockup"
                disabled={!ready || exporting}
                onClick={() => controller.current?.zoom(-1)}
              >
                <Minus size={14} />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label="Zoom in mockup"
                disabled={!ready || exporting}
                onClick={() => controller.current?.zoom(1)}
              >
                <Plus size={14} />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label="Reset mockup camera"
                disabled={!ready || exporting}
                onClick={() => camera("studio")}
              >
                <Maximize size={14} />
              </button>
            </div>
          </div>
          <div className={`mockup-stage-wrap ${exporting ? "exporting" : ""}`}>
            {input ? (
              <MockupStage
                input={input}
                controller={controller}
                onReady={setReady}
              />
            ) : (
              <div className="mockup-render-stage">
                <p className="mockup-stage-message" role="status">
                  Preparing artwork…
                </p>
              </div>
            )}
            {!current && input && (
              <div
                className="mockup-artwork-loading"
                role={error?.key === key ? "alert" : "status"}
              >
                {error?.key === key ? error.message : "Updating artwork…"}
              </div>
            )}
            {error?.key === key && !input && (
              <p role="alert" className="dialog-error">
                {error.message}
              </p>
            )}
          </div>
          <div className="mockup-stage-caption">
            <span id="mockup-camera-help">
              Drag to rotate · +/− to zoom · arrow keys rotate · Home resets
            </span>
            <button
              type="button"
              className="subtle-button"
              onClick={() =>
                settingsPanel.current?.scrollIntoView({ block: "center" })
              }
            >
              Appearance & placement ↓
            </button>
            <span>PNG · 2048px</span>
          </div>
          <MockupAppearanceControls
            settings={settings}
            update={update}
            effectiveSource={effectiveSource}
            setSource={setSource}
            options={options}
            exporting={exporting}
            settingsPanel={settingsPanel}
          />
          {(effectiveSource === "composition" ||
            effectiveSource === "symbol") && (
            <label className="mockup-background-check">
              <input
                type="checkbox"
                disabled={exporting}
                checked={includeBackground}
                onChange={(event) => setIncludeBackground(event.target.checked)}
              />
              Include composition background
            </label>
          )}
          {(effectiveSource === "original" ||
            ((effectiveSource === "composition" ||
              effectiveSource === "symbol") &&
              concept.document.symbolSource === "image" &&
              !concept.document.useCutout)) && (
            <p className="field-help">
              Image backgrounds remain part of the artwork. Use a transparent
              cutout for a clean printed mark.
            </p>
          )}
          {concept.raster && !concept.cutout && (
            <button
              type="button"
              className="subtle-button"
              disabled={exporting || studio.busy}
              onClick={() => setCutoutDialog(concept.id)}
            >
              Prepare a transparent cutout
            </button>
          )}
          {cutoutDialog === concept.id && (
            <BackgroundDialog
              concept={concept}
              studio={studio}
              close={(saved) => {
                if (saved && effectiveSource === "original")
                  setSource("cutout");
                setCutoutDialog(null);
              }}
            />
          )}
          {settings.finish === "foil" && !digital && (
            <p className="field-help">
              Gold foil uses the artwork silhouette with a metallic tint.
              Original logo colours stay saved.
            </p>
          )}
          <p className="exploration-note">
            Local 3D studio render · {concept.name}. Lighting and materials
            affect appearance; this is a presentation mockup, not a print colour
            proof.
          </p>
          {exportError && (
            <p role="alert" className="dialog-error">
              {exportError}
            </p>
          )}
        </>
      )}
    </section>
  );
}
