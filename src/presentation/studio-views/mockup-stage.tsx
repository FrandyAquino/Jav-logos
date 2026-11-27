import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type {
  MockupRenderer,
  MockupRenderInput,
} from "../../infrastructure/mockups/renderer";
export function MockupStage({
  input,
  controller,
  onReady,
}: {
  input: MockupRenderInput;
  controller: MutableRefObject<MockupRenderer | null>;
  onReady: (value: boolean) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef(input);
  latest.current = input;
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    let instance: MockupRenderer | undefined;
    setError("");
    setLoaded(false);
    onReady(false);
    void import("../../infrastructure/mockups/renderer")
      .then(async ({ MockupRenderer }) => {
        if (!active || !canvas.current) return;
        instance = new MockupRenderer(canvas.current, (message) => {
          if (active) {
            setError(message);
            onReady(false);
          }
        });
        controller.current = instance;
        await instance.ready;
        if (!active) return;
        instance.update(latest.current);
        setLoaded(true);
        onReady(true);
      })
      .catch((error) => {
        if (active) {
          setError(error instanceof Error ? error.message : String(error));
          onReady(false);
        }
      });
    return () => {
      active = false;
      instance?.dispose();
      controller.current = null;
    };
  }, [attempt, controller, onReady]);
  useEffect(() => {
    if (controller.current && !error) {
      try {
        controller.current.update(input);
      } catch (error) {
        setError(error instanceof Error ? error.message : String(error));
        onReady(false);
      }
    }
  }, [input, controller, onReady, error]);
  return (
    <div
      className="mockup-render-stage"
      data-render-state={error ? "error" : loaded ? "ready" : "loading"}
    >
      <canvas
        key={attempt}
        ref={canvas}
        className={error ? "mockup-canvas-hidden" : ""}
        aria-label="Interactive 3D mockup"
        role="img"
        tabIndex={0}
        aria-describedby="mockup-camera-help"
      />
      {!loaded && !error && (
        <div className="mockup-stage-message" role="status">
          Preparing studio lighting…
        </div>
      )}
      {error && (
        <div className="mockup-stage-message mockup-stage-error">
          <p role="alert">{error}</p>
          <img
            src={input.artwork.toDataURL("image/png")}
            alt="Flat artwork fallback"
          />
          <button
            type="button"
            className="outline-button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Retry 3D preview
          </button>
        </div>
      )}
    </div>
  );
}
