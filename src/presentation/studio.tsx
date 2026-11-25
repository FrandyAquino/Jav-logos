import {
  useEffect,
  useState,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertCircle,
  ArrowDownToLine,
  Check,
  Cpu,
  LoaderCircle,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Sun,
  X,
} from "lucide-react";
import { useStudio } from "../application/use-studio";
import { BrandSidebar } from "./brand-sidebar";
import { CreativeCanvas } from "./creative-canvas";
import { Inspector } from "./inspector";
import { IconButton, Mark, shortcutModifier } from "./ui";
import { CommandPalette, type StudioCommand } from "./command-palette";

export function Studio() {
  const studio = useStudio();
  const recoveryInput = useRef<HTMLInputElement>(null);
  const commandOrigin = useRef<HTMLElement | null>(null);
  const dialogOrigin = useRef<HTMLElement | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createFailed, setCreateFailed] = useState(false);
  const [newName, setNewName] = useState("");
  const [parentId, setParentId] = useState("");
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [providerOpen, setProviderOpen] = useState(false);
  const [checkingProvider, setCheckingProvider] = useState(false);
  const [leftWidth, setLeftWidth] = useState(224);
  const [rightWidth, setRightWidth] = useState(288);
  const rememberDialogOrigin = () => {
    dialogOrigin.current = commandsOpen
      ? commandOrigin.current
      : document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  };
  const restoreDialogFocus = (event: Event) => {
    event.preventDefault();
    const target = dialogOrigin.current;
    if (target?.isConnected) target.focus();
    else document.querySelector<HTMLButtonElement>(".command-trigger")?.focus();
  };
  const openCreate = (parent?: string) => {
    rememberDialogOrigin();
    setCreateFailed(false);
    setNewName("");
    setParentId(parent ?? "");
    setCreateOpen(true);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (createOpen || providerOpen) return;
        if (!commandsOpen)
          commandOrigin.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
        setCommandsOpen(!commandsOpen);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        if (
          creating ||
          studio.busy ||
          !studio.ready ||
          createOpen ||
          providerOpen ||
          commandsOpen
        )
          return;
        setCommandsOpen(false);
        setProviderOpen(false);
        dialogOrigin.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        setCreateFailed(false);
        setNewName("");
        setParentId("");
        setCreateOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    commandsOpen,
    createOpen,
    providerOpen,
    creating,
    studio.busy,
    studio.ready,
  ]);

  const checkProvider = async () => {
    if (checkingProvider) return;
    setCheckingProvider(true);
    try {
      await studio.refreshProvider();
    } finally {
      setCheckingProvider(false);
    }
  };

  const resize = (
    side: "left" | "right",
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = event.clientX;
    const width = side === "left" ? leftWidth : rightWidth;
    const element = event.currentTarget;
    const move = (next: PointerEvent) => {
      const delta = next.clientX - start;
      if (side === "left")
        setLeftWidth(Math.max(190, Math.min(340, width + delta)));
      else setRightWidth(Math.max(260, Math.min(400, width - delta)));
    };
    const end = () => {
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", end);
      element.removeEventListener("pointercancel", end);
    };
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", end);
    element.addEventListener("pointercancel", end);
  };

  const commands: StudioCommand[] = [
    {
      label: "Import recovery copy",
      run: () => recoveryInput.current?.click(),
    },
    {
      label: "Create a brand",
      shortcut: `${shortcutModifier} N`,
      opensDialog: true,
      run: () => openCreate(),
    },
    {
      label: "Create a sub-brand",
      opensDialog: true,
      disabled: !studio.selectedBrand,
      run: () => openCreate(studio.selectedBrand?.id),
    },
    {
      label: "Save current version",
      disabled: !studio.selectedConcept,
      run: () => void studio.saveVersion(),
    },
    {
      label: "Export brand kit",
      disabled: !studio.selectedConcept,
      run: () => void studio.exportKit(),
    },
    {
      label: "Check local AI provider",
      opensDialog: true,
      run: () => {
        rememberDialogOrigin();
        void checkProvider();
        setProviderOpen(true);
      },
    },
    {
      label: `Switch to ${studio.theme === "dark" ? "light" : "dark"} theme`,
      run: () => studio.setTheme(studio.theme === "dark" ? "light" : "dark"),
    },
  ].map((command) => ({
    ...command,
    disabled: command.disabled || studio.busy || creating || !studio.ready,
  }));

  return (
    <div
      className="studio"
      data-native-macos={
        studio.native && /Mac/.test(navigator.platform) ? true : undefined
      }
      data-theme={studio.theme}
      style={
        {
          "--left-width": `${leftWidth}px`,
          "--right-width": `${rightWidth}px`,
        } as CSSProperties
      }
    >
      <input
        ref={recoveryInput}
        type="file"
        accept="application/json,.json"
        hidden
        tabIndex={-1}
        aria-label="Recovery copy"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void studio.importRecoveryFile(file);
          event.target.value = "";
        }}
      />
      <header className="topbar" data-tauri-drag-region>
        <div className="wordmark" aria-label="JavLogos brand identity studio">
          <Mark small />
          <strong>
            Jav<span>Logos</span>
          </strong>
          <span className="app-label">STUDIO</span>
        </div>
        <button
          type="button"
          className="command-trigger"
          aria-label="Search commands"
          title={`Search commands (${shortcutModifier} K)`}
          onClick={(event) => {
            commandOrigin.current = event.currentTarget;
            setCommandsOpen(true);
          }}
        >
          <Search size={13} />
          <span>Search commands</span>
          <kbd>{shortcutModifier} K</kbd>
        </button>
        <div className="topbar-actions">
          <IconButton
            label={`Switch to ${studio.theme === "dark" ? "light" : "dark"} theme`}
            onClick={() =>
              studio.setTheme(studio.theme === "dark" ? "light" : "dark")
            }
          >
            {studio.theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </IconButton>
          <button
            type="button"
            className="outline-button export-top"
            onClick={() => void studio.exportKit()}
            disabled={!studio.selectedConcept || studio.busy}
          >
            <ArrowDownToLine size={14} /> Export kit
          </button>
        </div>
      </header>
      {studio.pendingConcepts.length > 0 && !studio.busy && (
        <div className="error-banner" role="status">
          <AlertCircle size={16} />
          <span>
            {studio.pendingConcepts.length} generated concepts are waiting to
            save. Keep this window open or export a recovery copy.
          </span>
          <button
            className="outline-button"
            onClick={() => void studio.retryPendingSave()}
          >
            Retry save
          </button>
          <button
            className="outline-button"
            onClick={() => void studio.exportPendingBatch()}
          >
            Export recovery copy
          </button>
        </div>
      )}
      {studio.error && (
        <div className="error-banner" role="alert">
          <AlertCircle size={16} />
          <span>{studio.error}</span>
          <IconButton label="Dismiss error" onClick={studio.dismissError}>
            <X size={14} />
          </IconButton>
        </div>
      )}
      <div className="studio-panels">
        <BrandSidebar studio={studio} onCreate={openCreate} />
        <div
          className="resize-handle"
          role="separator"
          aria-label="Resize brand library"
          aria-orientation="vertical"
          aria-valuenow={leftWidth}
          aria-valuemin={190}
          aria-valuemax={340}
          tabIndex={0}
          onPointerDown={(event) => resize("left", event)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              setLeftWidth((width) =>
                Math.max(
                  190,
                  Math.min(
                    340,
                    width + (event.key === "ArrowRight" ? 10 : -10),
                  ),
                ),
              );
            }
          }}
        />
        <CreativeCanvas studio={studio} onCreate={() => openCreate()} />
        <div
          className="resize-handle"
          role="separator"
          aria-label="Resize properties inspector"
          aria-orientation="vertical"
          aria-valuenow={rightWidth}
          aria-valuemin={260}
          aria-valuemax={400}
          tabIndex={0}
          onPointerDown={(event) => resize("right", event)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              setRightWidth((width) =>
                Math.max(
                  260,
                  Math.min(400, width + (event.key === "ArrowLeft" ? 10 : -10)),
                ),
              );
            }
          }}
        />
        <Inspector studio={studio} />
      </div>
      <footer className="statusbar">
        <div className="save-status" role="status">
          {studio.busy ? (
            <LoaderCircle size={12} className="spin" />
          ) : studio.error || studio.pendingConcepts.length ? (
            <AlertCircle size={12} />
          ) : (
            <Check size={12} />
          )}
          <span>{studio.status}</span>
        </div>
        <button
          type="button"
          className="provider-status"
          onClick={() => {
            rememberDialogOrigin();
            setProviderOpen(true);
          }}
        >
          <span
            className={`status-dot ${studio.providerHealth.available ? "ready" : ""}`}
          />
          <span>
            {studio.providerHealth.available
              ? "Local AI ready"
              : "Local AI setup"}
          </span>
          <Cpu size={12} />
        </button>
        <span
          className={`ecosystem-label ${!studio.native ? "browser-label" : ""}`}
        >
          {studio.native ? "JavCollections" : "Browser preview"}
        </span>
      </footer>

      <Dialog.Root
        open={createOpen}
        onOpenChange={(open) => {
          if (!creating) setCreateOpen(open);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content
            className="dialog-content"
            data-theme={studio.theme}
            onCloseAutoFocus={restoreDialogFocus}
          >
            <div className="dialog-icon">
              <Plus size={22} />
            </div>
            <Dialog.Title>Create a brand</Dialog.Title>
            <Dialog.Description>
              Name this identity and choose whether it inherits from another
              brand.
            </Dialog.Description>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                if (!newName.trim() || creating) return;
                setCreating(true);
                setCreateFailed(false);
                try {
                  const created = await studio.createBrand(
                    newName.trim(),
                    parentId || undefined,
                  );
                  if (created) setCreateOpen(false);
                  else setCreateFailed(true);
                } finally {
                  setCreating(false);
                }
              }}
            >
              <label className="dialog-field">
                Brand name
                <input
                  autoFocus
                  required
                  disabled={creating}
                  maxLength={100}
                  placeholder="e.g. JavCollections"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                />
              </label>
              <label className="dialog-field">
                Brand family
                <select
                  disabled={creating}
                  value={parentId}
                  onChange={(event) => setParentId(event.target.value)}
                >
                  <option value="">Independent parent brand</option>
                  {studio.workspace.brands.map((brand) => (
                    <option value={brand.id} key={brand.id}>
                      Inherit from {brand.name}
                    </option>
                  ))}
                </select>
              </label>
              {createFailed && (
                <p className="dialog-error" role="alert">
                  {studio.error ||
                    "The brand could not be saved. Resolve the workspace error and try again."}
                </p>
              )}
              <div className="dialog-actions">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="subtle-button"
                    disabled={creating}
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={!newName.trim() || studio.busy || creating}
                >
                  {creating ? "Creating…" : "Create brand"}
                </button>
              </div>
            </form>
            <Dialog.Close
              className="dialog-close"
              aria-label="Close create brand dialog"
              disabled={creating}
            >
              <X size={17} />
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <CommandPalette
        open={commandsOpen}
        onOpenChange={setCommandsOpen}
        theme={studio.theme}
        commands={commands}
        returnFocus={() => commandOrigin.current?.focus()}
      />

      <Dialog.Root open={providerOpen} onOpenChange={setProviderOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content
            className="dialog-content"
            data-theme={studio.theme}
            onCloseAutoFocus={restoreDialogFocus}
          >
            <div className="dialog-icon">
              <Cpu size={22} />
            </div>
            <Dialog.Title>Local generation</Dialog.Title>
            <Dialog.Description>
              {studio.providerHealth.provider || "Local AI provider"}
            </Dialog.Description>
            <div className="provider-message">
              <span
                className={`status-dot ${studio.providerHealth.available ? "ready" : ""}`}
              />
              <p>{studio.providerHealth.message}</p>
            </div>
            <p className="field-help">
              Geometric concepts work offline without a model. Local AI requires
              an installed, configured worker runtime.
            </p>
            <div className="dialog-actions">
              <Dialog.Close asChild>
                <button type="button" className="subtle-button">
                  Close
                </button>
              </Dialog.Close>
              <button
                type="button"
                className="primary-button"
                disabled={checkingProvider}
                onClick={() => void checkProvider()}
              >
                <RefreshCw
                  size={14}
                  className={checkingProvider ? "spin" : undefined}
                />{" "}
                {checkingProvider ? "Checking…" : "Check again"}
              </button>
            </div>
            <Dialog.Close
              className="dialog-close"
              aria-label="Close provider details"
            >
              <X size={17} />
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
