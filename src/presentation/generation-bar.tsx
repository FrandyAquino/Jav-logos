import { useRef, useState } from "react";
import { ArrowUp, ImagePlus, LoaderCircle, Square, X } from "lucide-react";
import { IconButton, type StudioState } from "./ui";

export function GenerationBar({ studio }: { studio: StudioState }) {
  const [provider, setProvider] = useState<"procedural" | "local">(
    "procedural",
  );
  const [count, setCount] = useState(4);
  const fileInput = useRef<HTMLInputElement>(null);
  const unavailable = provider === "local" && !studio.providerHealth.available;
  const generate = () => {
    if (
      !studio.busy &&
      !unavailable &&
      studio.selectedBrand &&
      studio.prompt.trim()
    )
      void studio.generate(provider, count);
  };
  return (
    <section className="generation-area" aria-label="Generate concepts">
      {studio.referenceUrl && (
        <div className="reference-preview">
          <img src={studio.referenceUrl} alt="Generation reference" />
          <span>Visual reference</span>
          <IconButton label="Remove reference" onClick={studio.clearReference}>
            <X size={13} />
          </IconButton>
        </div>
      )}
      <form
        className="prompt-composer"
        onSubmit={(event) => {
          event.preventDefault();
          generate();
        }}
      >
        <textarea
          aria-label="Describe your logo"
          placeholder={
            studio.selectedBrand
              ? `Describe the next direction for ${studio.selectedBrand.name}…`
              : "Create a brand to start exploring…"
          }
          value={studio.prompt}
          disabled={!studio.selectedBrand || studio.busy}
          rows={2}
          maxLength={4000}
          onChange={(event) => studio.setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              generate();
            }
          }}
        />
        <div className="composer-tools">
          <div className="composer-options">
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="visually-hidden"
              aria-label="Reference image"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void studio.importReference(file);
                event.target.value = "";
              }}
            />
            <IconButton
              label="Add reference image"
              onClick={() => fileInput.current?.click()}
              disabled={!studio.selectedBrand || studio.busy}
            >
              <ImagePlus size={16} />
            </IconButton>
            <span className="tool-divider" />
            <select
              aria-label="Generation provider"
              value={provider}
              disabled={studio.busy}
              onChange={(event) =>
                setProvider(event.target.value as "procedural" | "local")
              }
            >
              <option value="procedural">Geometric concepts</option>
              <option value="local">Local AI · FLUX</option>
            </select>
            <select
              aria-label="Number of concepts"
              value={count}
              disabled={studio.busy}
              onChange={(event) => setCount(Number(event.target.value))}
            >
              {[1, 2, 3, 4].map((number) => (
                <option key={number} value={number}>
                  {number} {number === 1 ? "concept" : "concepts"}
                </option>
              ))}
            </select>
          </div>
          {studio.busy && !studio.cancellable ? (
            <span className="working-label">
              <LoaderCircle className="spin" size={14} /> Working…
            </span>
          ) : studio.busy ? (
            <button
              className="generate-button stop"
              type="button"
              onClick={() => void studio.cancelGeneration()}
            >
              <Square size={12} /> Cancel
            </button>
          ) : (
            <button
              className="generate-button"
              type="submit"
              disabled={
                !studio.selectedBrand || !studio.prompt.trim() || unavailable
              }
            >
              <span>Generate</span>
              <ArrowUp size={16} />
            </button>
          )}
        </div>
      </form>
      <div className="composer-caption">
        {studio.busy ? (
          <>
            <LoaderCircle className="spin" size={12} /> {studio.status}
          </>
        ) : unavailable ? (
          <>
            <span className="warning-dot" />
            Local AI is unavailable. Check the provider status below.
          </>
        ) : provider === "procedural" ? (
          "Editable geometric explorations · no AI model used"
        ) : (
          "Generated locally on your machine · ⌘ / Ctrl + Enter"
        )}
      </div>
    </section>
  );
}
