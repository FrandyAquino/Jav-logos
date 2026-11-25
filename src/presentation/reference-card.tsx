import * as Dialog from "@radix-ui/react-dialog";
import { Expand, RefreshCw, X } from "lucide-react";
import { IconButton } from "./ui";

interface ReferenceInfo {
  name: string;
  width: number;
  height: number;
  size: number;
}
function details(info: ReferenceInfo | null): string {
  if (!info) return "Image reference";
  const bytes =
    info.size >= 1_000_000
      ? `${(info.size / 1_000_000).toFixed(1)} MB`
      : `${Math.max(1, Math.round(info.size / 1000))} KB`;
  return `${info.width} × ${info.height} · ${bytes}`;
}

export function ReferenceCard({
  url,
  info,
  theme,
  disabled,
  active,
  onReplace,
  onRemove,
}: {
  url: string;
  info: ReferenceInfo | null;
  theme: "light" | "dark";
  disabled: boolean;
  active: boolean;
  onReplace: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="reference-card">
      <Dialog.Root>
        <Dialog.Trigger asChild>
          <button
            className="reference-thumbnail"
            type="button"
            aria-label="Preview reference image"
            title="Preview reference image"
          >
            <img src={url} alt="" />
            <span>
              <Expand size={13} />
            </span>
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content
            className="dialog-content reference-dialog"
            data-theme={theme}
          >
            <Dialog.Title>{info?.name || "Reference image"}</Dialog.Title>
            <Dialog.Description>
              {details(info)}. This image guides local AI generation.
            </Dialog.Description>
            <div className="reference-full-image">
              <img src={url} alt={info?.name || "Generation reference"} />
            </div>
            <Dialog.Close
              className="dialog-close"
              aria-label="Close reference preview"
            >
              <X size={17} />
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <div className="reference-description">
        <strong title={info?.name}>{info?.name || "Reference image"}</strong>
        <span>{details(info)}</span>
        <small>
          {active ? "Guides this generation" : "Used with Local AI"}
        </small>
      </div>
      <div className="reference-actions">
        <IconButton
          label="Replace reference"
          onClick={onReplace}
          disabled={disabled}
        >
          <RefreshCw size={14} />
        </IconButton>
        <IconButton
          label="Remove reference"
          onClick={onRemove}
          disabled={disabled}
        >
          <X size={15} />
        </IconButton>
      </div>
    </div>
  );
}
