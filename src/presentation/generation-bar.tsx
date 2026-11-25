import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, ImagePlus, LoaderCircle, Square } from "lucide-react";
import { IconButton, shortcutModifier, type StudioState } from "./ui";
import { SelectField } from "./select-field";
import { ReferenceCard } from "./reference-card";

function isFileDrag(transfer: DataTransfer) {
  return (
    Array.from(transfer.types).includes("Files") &&
    !Array.from(transfer.types).includes("application/x-javlogos-brand")
  );
}

function pastedImage(file: File) {
  if (file.name && !/^image(?:\.[^.]*)?$/i.test(file.name)) return file;
  const extension =
    file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  return new File([file], `Pasted image.${extension}`, {
    type: file.type,
    lastModified: file.lastModified,
  });
}

export function GenerationBar({ studio }: { studio: StudioState }) {
  const [provider, setProvider] = useState<"procedural" | "local">(
    "procedural",
  );
  const [count, setCount] = useState(4);
  const [dragDepth, setDragDepth] = useState(0);
  const [referenceNotice, setReferenceNotice] = useState("");
  useEffect(() => {
    if (studio.referenceUrl) setProvider("local");
  }, [studio.referenceUrl]);
  const fileInput = useRef<HTMLInputElement>(null);
  const promptInput = useRef<HTMLTextAreaElement>(null);
  const archived = studio.selectedBrand?.status === "archived";
  const unavailable = provider === "local" && !studio.providerHealth.available;
  const inputDisabled = !studio.selectedBrand || studio.busy || archived;
  const referenceDisabled = inputDisabled || studio.referenceLoading;
  const dropActive = !referenceDisabled && dragDepth > 0;
  const canGenerate =
    !inputDisabled &&
    !unavailable &&
    !studio.referenceLoading &&
    Boolean(studio.prompt.trim());

  useLayoutEffect(() => {
    const textarea = promptInput.current;
    if (!textarea) return;
    const resize = () => {
      textarea.style.height = "0px";
      textarea.style.height = `${Math.min(156, Math.max(56, textarea.scrollHeight))}px`;
      textarea.style.overflowY =
        textarea.scrollHeight > 156 ? "auto" : "hidden";
    };
    resize();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    }
    let width = textarea.getBoundingClientRect().width;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width === width) return;
      width = entry.contentRect.width;
      resize();
    });
    observer.observe(textarea);
    return () => observer.disconnect();
  }, [studio.prompt]);

  const generate = () => {
    if (canGenerate) void studio.generate(provider, count);
  };

  return (
    <section className="generation-area" aria-label="Generate concepts">
      <form
        className={`prompt-composer${dropActive ? " reference-drop-active" : ""}`}
        onPaste={(event) => {
          if (referenceDisabled) return;
          const images = Array.from(event.clipboardData.items)
            .filter(
              (item) => item.kind === "file" && item.type.startsWith("image/"),
            )
            .map((item) => item.getAsFile())
            .filter((file): file is File => file !== null);
          if (!images.length) return;
          event.preventDefault();
          setReferenceNotice(
            images.length > 1
              ? "Only one reference is used. Taking the first image."
              : "",
          );
          void studio.importReference(pastedImage(images[0]));
        }}
        onDragEnter={(event) => {
          if (referenceDisabled || !isFileDrag(event.dataTransfer)) return;
          event.preventDefault();
          setDragDepth((depth) => depth + 1);
        }}
        onDragOver={(event) => {
          if (referenceDisabled || !isFileDrag(event.dataTransfer)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={() => setDragDepth((depth) => Math.max(0, depth - 1))}
        onDrop={(event) => {
          setDragDepth(0);
          if (referenceDisabled || !isFileDrag(event.dataTransfer)) return;
          const files = Array.from(event.dataTransfer.files);
          if (!files.length) return;
          event.preventDefault();
          setReferenceNotice(
            files.length > 1
              ? "Only one reference is used. Taking the first file."
              : "",
          );
          // Keep all file validation (including unsupported types) in the application action.
          void studio.importReference(files[0]);
        }}
        onSubmit={(event) => {
          event.preventDefault();
          generate();
        }}
      >
        <div
          className={
            dropActive
              ? "reference-drop-hint"
              : referenceNotice
                ? "reference-input-notice"
                : "visually-hidden"
          }
          role="status"
        >
          {dropActive ? "Drop image to use as reference" : referenceNotice}
        </div>
        {studio.referenceUrl && (
          <ReferenceCard
            url={studio.referenceUrl}
            info={studio.referenceInfo}
            theme={studio.theme}
            disabled={referenceDisabled}
            active={provider === "local"}
            onReplace={() => fileInput.current?.click()}
            onRemove={studio.clearReference}
          />
        )}
        {studio.referenceLoading && (
          <div className="reference-loading" role="status">
            <LoaderCircle size={14} className="spin" /> Preparing reference…
          </div>
        )}
        <textarea
          ref={promptInput}
          aria-label="Describe your logo"
          placeholder={
            studio.selectedBrand
              ? `Describe a direction for ${studio.selectedBrand.name}…`
              : "Create a brand to start exploring…"
          }
          value={studio.prompt}
          disabled={inputDisabled}
          rows={1}
          maxLength={3000}
          onChange={(event) => studio.setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (
              !event.nativeEvent.isComposing &&
              (event.metaKey || event.ctrlKey) &&
              event.key === "Enter"
            ) {
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
              hidden
              tabIndex={-1}
              disabled={referenceDisabled}
              aria-label="Reference image"
              onChange={(event) => {
                const file = event.target.files?.[0];
                setReferenceNotice("");
                if (file) void studio.importReference(file);
                event.target.value = "";
              }}
            />
            <IconButton
              label="Add reference image"
              onClick={() => fileInput.current?.click()}
              disabled={referenceDisabled}
            >
              <ImagePlus size={17} />
            </IconButton>
            <span className="tool-divider" />
            <SelectField
              label="Generation provider"
              value={provider}
              disabled={studio.busy}
              onValueChange={(value) =>
                setProvider(value as "procedural" | "local")
              }
              options={[
                {
                  value: "procedural",
                  label: "Geometric concepts",
                  description: "Editable vectors · no AI model",
                },
                {
                  value: "local",
                  label: "Local AI · FLUX",
                  description: "Generate images on this device",
                },
              ]}
            />
            <SelectField
              label="Number of concepts"
              value={String(count)}
              disabled={studio.busy}
              onValueChange={(value) => setCount(Number(value))}
              options={[1, 2, 3, 4].map((number) => ({
                value: String(number),
                label: `${number} ${number === 1 ? "concept" : "concepts"}`,
              }))}
            />
            {provider === "local" && (
              <SelectField
                label="Generation target"
                value={studio.generationTarget}
                onValueChange={(value) =>
                  studio.setGenerationTarget(value as "symbol" | "full-logo")
                }
                disabled={studio.busy}
                options={[
                  {
                    value: "symbol",
                    label: "Symbol + editable text",
                    description:
                      "Generate the mark; compose real typography in the studio",
                  },
                  {
                    value: "full-logo",
                    label: "Full image concept",
                    description:
                      "Generate the entire image, including requested lettering",
                  },
                ]}
              />
            )}
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
              disabled={!canGenerate}
            >
              <span>Generate</span>
              <ArrowUp size={16} />
            </button>
          )}
        </div>
      </form>
      {studio.submittedPrompt && (
        <details className="submitted-prompt">
          <summary>Last sent prompt</summary>
          <p>{studio.submittedPrompt}</p>
          <button
            type="button"
            className="subtle-button"
            disabled={studio.busy}
            onClick={studio.reuseSubmittedPrompt}
          >
            Use prompt again
          </button>
        </details>
      )}
      <div className="composer-caption">
        {archived ? (
          "This workspace is archived. Restore it from the library to generate."
        ) : studio.referenceLoading ? (
          "Your reference is being prepared before generation."
        ) : studio.busy ? (
          studio.cancellable ? (
            "Follow the live activity above. You can cancel this run."
          ) : (
            studio.status
          )
        ) : unavailable ? (
          <>
            <span className="warning-dot" /> Local AI is unavailable. Check the
            provider status below.
          </>
        ) : (
          <>
            <span>
              {provider === "procedural"
                ? "Editable geometric explorations · no AI model used"
                : "Local generation · your files stay on this device"}
            </span>
            <span>Paste or drop an image as reference</span>
            <kbd>{shortcutModifier} Enter</kbd>
          </>
        )}
      </div>
    </section>
  );
}
