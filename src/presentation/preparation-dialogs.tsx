import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { Concept } from "../domain/types";
import type { StudioState } from "./ui";
import { createCutout } from "../infrastructure/raster-tools";
import { bundledFont } from "../infrastructure/font-export";
import {
  DELIVERY_VARIANTS,
  canMakeMonochrome,
  prepareVariant,
  type DeliveryVariant,
  type PreparedVariant,
} from "../infrastructure/delivery-variants";
import "./preparation.css";

export function BackgroundDialog({
  concept,
  studio,
  close,
}: {
  concept: Concept;
  studio: StudioState;
  close: (saved?: boolean) => void;
}) {
  const [tolerance, setTolerance] = useState(24);
  const [enclosed, setEnclosed] = useState(false);
  const [preview, setPreview] = useState<{
    png: string;
    removedFraction: number;
    key: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const key = `${tolerance}:${enclosed}`;
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    void createCutout(
      concept.raster!,
      { tolerance, includeEnclosed: enclosed },
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) setPreview({ ...result, key });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? error.message : String(error));
      });
    return () => controller.abort();
  }, [concept.raster, tolerance, enclosed, key]);
  const ready = preview?.key === key && !error;
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !lock.current) close();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog-content preparation-dialog"
          data-theme={studio.theme}
          onEscapeKeyDown={(event) => {
            if (lock.current) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (lock.current) event.preventDefault();
          }}
        >
          <Dialog.Title>Remove flat background</Dialog.Title>
          <Dialog.Description>
            Preview a transparent copy. Your original image stays intact. Best
            for logos with one uniform background color.
          </Dialog.Description>
          <div className="cutout-previews">
            <figure>
              <img
                src={concept.raster}
                alt="Original symbol before background removal"
              />
              <figcaption>Original</figcaption>
            </figure>
            <figure className="alpha-preview">
              {ready ? (
                <img src={preview.png} alt="Transparent symbol preview" />
              ) : (
                <p role="status">
                  {error ? "Preview unavailable" : "Preparing preview…"}
                </p>
              )}
              <figcaption>Transparent copy</figcaption>
            </figure>
          </div>
          <label className="preparation-range">
            Background tolerance <output>{tolerance}</output>
            <input
              aria-label="Background tolerance"
              type="range"
              min={4}
              max={80}
              value={tolerance}
              disabled={saving}
              onChange={(event) => setTolerance(Number(event.target.value))}
            />
          </label>
          <label className="preparation-check">
            <input
              type="checkbox"
              checked={enclosed}
              disabled={saving}
              onChange={(event) => setEnclosed(event.target.checked)}
            />
            Also remove matching enclosed areas
          </label>
          <p className="field-help">
            Enclosed removal can erase intentional light details. Inspect the
            edges and counters before saving.
          </p>
          {error && (
            <p role="alert" className="dialog-error">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <Dialog.Close asChild>
              <button className="outline-button" disabled={saving}>
                Cancel
              </button>
            </Dialog.Close>
            <button
              className="primary-button"
              disabled={!ready || saving || studio.busy}
              onClick={async () => {
                if (!ready || lock.current) return;
                lock.current = true;
                setSaving(true);
                try {
                  if (await studio.saveCutout(concept.id, preview.png))
                    close(true);
                  else
                    setError(
                      "Could not save the copy. Your original is unchanged; close and retry after resolving the workspace error.",
                    );
                } finally {
                  lock.current = false;
                  setSaving(false);
                }
              }}
            >
              {saving ? "Saving…" : "Save as new concept"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function DeliveryDialog({
  concept,
  studio,
  close,
}: {
  concept: Concept;
  studio: StudioState;
  close: () => void;
}) {
  const mono = canMakeMonochrome(concept);
  const icon = concept.document.showSymbol !== false;
  const [ids, setIds] = useState<DeliveryVariant[]>(
    DELIVERY_VARIANTS.filter(
      (v) =>
        (mono || !["black", "white"].includes(v.id)) &&
        (icon || v.id !== "icon"),
    ).map((v) => v.id),
  );
  const [outlined, setOutlined] = useState(
    Boolean(bundledFont(concept.document.fontFamily)),
  );
  const [prepared, setPrepared] = useState<{
    key: string;
    variants: PreparedVariant[];
  } | null>(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const lock = useRef(false);
  const key = JSON.stringify([ids, outlined, concept.document]);
  useEffect(() => {
    let active = true;
    setError("");
    void Promise.all(ids.map((id) => prepareVariant(concept, id, outlined)))
      .then((variants) => {
        if (active) setPrepared({ key, variants });
      })
      .catch((error) => {
        if (active)
          setError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      active = false;
    };
  }, [concept, ids, outlined, key]);
  const ready = prepared?.key === key && !error && ids.length > 0;
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !lock.current) close();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog-content preparation-dialog"
          data-theme={studio.theme}
          onEscapeKeyDown={(event) => {
            if (lock.current) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (lock.current) event.preventDefault();
          }}
        >
          <Dialog.Title>Export logo variants</Dialog.Title>
          <Dialog.Description>
            Fitted arrangements and transparent canvases from this concept.
            Original artwork and saved composition stay unchanged.
          </Dialog.Description>
          <div className="delivery-options">
            {DELIVERY_VARIANTS.map((variant) => (
              <label className="preparation-check" key={variant.id}>
                <input
                  type="checkbox"
                  checked={ids.includes(variant.id)}
                  disabled={
                    exporting ||
                    (!mono && ["black", "white"].includes(variant.id)) ||
                    (!icon && variant.id === "icon")
                  }
                  onChange={(event) =>
                    setIds((current) =>
                      event.target.checked
                        ? [...current, variant.id]
                        : current.filter((id) => id !== variant.id),
                    )
                  }
                />
                {variant.label}
              </label>
            ))}
          </div>
          <label className="preparation-check">
            <input
              type="checkbox"
              checked={outlined}
              disabled={exporting}
              onChange={(event) => setOutlined(event.target.checked)}
            />
            Convert text to outlines
          </label>
          {!bundledFont(concept.document.fontFamily) && (
            <p className="field-help">
              Outlining needs a bundled font. Choose Manrope, Google Sans Flex
              or another bundled family in Design; system font files are
              unavailable.
            </p>
          )}
          {!mono && (
            <p className="field-help">
              Save a transparent cutout to enable black and white image
              variants.
            </p>
          )}
          {concept.document.symbolSource === "custom" && (
            <p className="field-help">
              Monochrome uses one fill for all paths. Inspect holes and
              background paths before delivery.
            </p>
          )}
          {error ? (
            <p role="alert" className="dialog-error">
              {error}
            </p>
          ) : ready ? (
            <div className="delivery-grid">
              {prepared.variants.map((variant) => (
                <figure key={variant.id}>
                  <div
                    className={`delivery-art alpha-preview ${variant.id === "white" ? "dark-preview" : ""}`}
                  >
                    <img
                      src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(variant.svg)}`}
                      alt={`${variant.id} delivery preview`}
                    />
                  </div>
                  <figcaption>
                    {DELIVERY_VARIANTS.find((v) => v.id === variant.id)?.label}
                    {variant.containsRaster ? " · raster symbol" : ""}
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <p role="status">
              {ids.length
                ? "Preparing variants…"
                : "Choose at least one variant."}
            </p>
          )}
          <p className="field-help">
            ZIP includes SVG/PNG variants, 16/32/48px PNG favicons, font license
            and provenance. White logos need a dark viewing surface. Review
            small lettering before use.
          </p>
          <div className="dialog-actions">
            <Dialog.Close asChild>
              <button className="outline-button" disabled={exporting}>
                Close
              </button>
            </Dialog.Close>
            <button
              className="primary-button"
              disabled={!ready || exporting || studio.busy}
              onClick={async () => {
                if (!ready || lock.current) return;
                lock.current = true;
                setExporting(true);
                try {
                  await studio.exportDelivery(concept.id, ids, outlined);
                } finally {
                  lock.current = false;
                  setExporting(false);
                }
              }}
            >
              {exporting ? "Exporting…" : "Export variants ZIP"}
            </button>
          </div>
          {studio.error && (
            <p role="alert" className="dialog-error">
              {studio.error}
            </p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
