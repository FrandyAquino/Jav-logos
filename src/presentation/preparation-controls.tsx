import { useRef, useState } from "react";
import { Download, Eraser } from "lucide-react";
import type { StudioState } from "./ui";
import { BackgroundDialog, DeliveryDialog } from "./preparation-dialogs";
export function PreparationControls({ studio }: { studio: StudioState }) {
  const [dialog, setDialog] = useState<"background" | "delivery" | null>(null);
  const origin = useRef<HTMLButtonElement | null>(null);
  const concept = studio.selectedConcept;
  if (!concept) return null;
  const close = () => {
    setDialog(null);
    requestAnimationFrame(() => {
      if (origin.current?.isConnected) origin.current.focus();
      else
        document
          .querySelector<HTMLButtonElement>(
            '[data-concept-select][aria-pressed="true"]',
          )
          ?.focus();
    });
  };
  return (
    <div className="inspector-section preparation-controls">
      <h3>Prepare for delivery</h3>
      <label className="preparation-check">
        <input
          type="checkbox"
          checked={concept.document.autoFitText ?? false}
          disabled={studio.busy}
          onChange={(event) =>
            void studio.updateConcept({ autoFitText: event.target.checked })
          }
        />
        Auto-fit name and slogan
      </label>
      <label className="preparation-check">
        <input
          type="checkbox"
          checked={concept.document.transparentBackground ?? false}
          disabled={studio.busy}
          onChange={(event) =>
            void studio.updateConcept({
              transparentBackground: event.target.checked,
            })
          }
        />
        Transparent canvas
      </label>
      {concept.cutout && (
        <label className="preparation-check">
          <input
            type="checkbox"
            checked={concept.document.useCutout ?? false}
            disabled={studio.busy || concept.document.symbolSource !== "image"}
            onChange={(event) =>
              void studio.updateConcept({ useCutout: event.target.checked })
            }
          />
          Use transparent symbol
        </label>
      )}
      {concept.raster && (
        <>
          <button
            className="outline-button full-width"
            disabled={studio.busy}
            onClick={(event) => {
              origin.current = event.currentTarget;
              setDialog("background");
            }}
          >
            <Eraser size={14} />
            Remove flat background
          </button>
          <p className="field-help">
            Transparent canvas does not remove the background inside an original
            image.
          </p>
        </>
      )}
      {concept.document.autoFitText &&
        Math.min(
          (concept.document.wordmarkSize ?? 38) *
            (concept.document.wordmarkFit ?? 1),
          concept.document.slogan
            ? (concept.document.sloganSize ?? 18) *
                (concept.document.sloganFit ?? 1)
            : 100,
        ) < 10 && (
          <p className="field-help">
            Text fits but is very small. Shorten it or try another arrangement.
          </p>
        )}
      <button
        className="outline-button full-width"
        disabled={studio.busy}
        onClick={() => void studio.exportOutlinedSvg()}
      >
        <Download size={14} />
        Outlined SVG
      </button>
      <button
        className="outline-button full-width"
        disabled={studio.busy}
        onClick={(event) => {
          origin.current = event.currentTarget;
          setDialog("delivery");
        }}
      >
        <Download size={14} />
        Logo variants
      </button>
      {dialog === "background" && (
        <BackgroundDialog concept={concept} studio={studio} close={close} />
      )}
      {dialog === "delivery" && (
        <DeliveryDialog concept={concept} studio={studio} close={close} />
      )}
    </div>
  );
}
