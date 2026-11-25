import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Trash2 } from "lucide-react";
import type { Concept } from "../domain/types";
import type { StudioState } from "./ui";

export function DeleteConceptDialog({
  concept,
  studio,
  onClose,
  restoreFocus,
}: {
  concept: Pick<Concept, "id" | "name" | "brandId">;
  studio: StudioState;
  onClose: () => void;
  restoreFocus: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const cancel = useRef<HTMLButtonElement>(null);
  const brandName = studio.workspace.brands.find(
    (brand) => brand.id === concept.brandId,
  )?.name;
  async function confirm() {
    if (inFlight.current || studio.busy) return;
    inFlight.current = true;
    setSaving(true);
    setError("");
    try {
      if (await studio.deleteConcept(concept.id)) onClose();
      else
        setError(
          "The concept could not be deleted. It is still saved. Try again after resolving the workspace error.",
        );
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !inFlight.current) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog-content"
          data-theme={studio.theme}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            cancel.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            restoreFocus();
          }}
          onEscapeKeyDown={(event) => {
            if (inFlight.current) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (inFlight.current) event.preventDefault();
          }}
        >
          <Dialog.Title>Delete concept?</Dialog.Title>
          <Dialog.Description>
            Delete “{concept.name}”{brandName ? ` from ${brandName}` : ""},
            including its saved versions, notes and artwork references. This
            cannot be undone. Other concepts and exported files stay intact.
          </Dialog.Description>
          {error && (
            <p role="alert" className="dialog-error">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <Dialog.Close asChild>
              <button
                type="button"
                ref={cancel}
                className="outline-button"
                disabled={saving}
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              className="outline-button destructive-button"
              disabled={saving || studio.busy}
              onClick={() => void confirm()}
            >
              <Trash2 size={14} />
              {saving ? "Deleting…" : "Delete concept"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
