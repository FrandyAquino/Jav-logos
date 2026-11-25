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
  Command,
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
import { IconButton, Mark } from "./ui";

export function Studio() {
  const studio = useStudio();
  const recoveryInput = useRef<HTMLInputElement>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [parentId, setParentId] = useState("");
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [commandSearch, setCommandSearch] = useState("");
  const [providerOpen, setProviderOpen] = useState(false);
  const [leftWidth, setLeftWidth] = useState(224);
  const [rightWidth, setRightWidth] = useState(288);
  const openCreate = (parent?: string) => {
    setNewName("");
    setParentId(parent ?? "");
    setCreateOpen(true);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandsOpen((open) => !open);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        setNewName("");
        setParentId("");
        setCreateOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  const commands = [
    {
      label: "Import recovery copy",
      run: () => recoveryInput.current?.click(),
    },
    { label: "Create a brand", shortcut: "⌘ N", run: () => openCreate() },
    {
      label: "Create a sub-brand",
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
      run: () => {
        void studio.refreshProvider();
        setProviderOpen(true);
      },
    },
    {
      label: `Switch to ${studio.theme === "dark" ? "light" : "dark"} theme`,
      run: () => studio.setTheme(studio.theme === "dark" ? "light" : "dark"),
    },
  ].filter((command) =>
    command.label.toLowerCase().includes(commandSearch.toLowerCase()),
  );

  return (
    <div
      className="studio"
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
        className="visually-hidden"
        aria-label="Recovery copy"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void studio.importRecoveryFile(file);
          event.target.value = "";
        }}
      />
      <header className="topbar">
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
          onClick={() => {
            setCommandSearch("");
            setCommandsOpen(true);
          }}
        >
          <Search size={13} />
          <span>Search commands</span>
          <kbd>⌘ K</kbd>
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
          ) : (
            <Check size={12} />
          )}
          <span>{studio.status}</span>
        </div>
        <button
          type="button"
          className="provider-status"
          onClick={() => setProviderOpen(true)}
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
          <Dialog.Content className="dialog-content" data-theme={studio.theme}>
            <div className="dialog-icon">
              <Plus size={22} />
            </div>
            <Dialog.Title>Create a brand</Dialog.Title>
            <Dialog.Description>
              A new identity, with its own character and a place in your brand
              family.
            </Dialog.Description>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                if (!newName.trim() || creating) return;
                setCreating(true);
                try {
                  if (
                    await studio.createBrand(
                      newName.trim(),
                      parentId || undefined,
                    )
                  )
                    setCreateOpen(false);
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
                  maxLength={100}
                  placeholder="e.g. JavCollections"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                />
              </label>
              <label className="dialog-field">
                Brand family
                <select
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
              <div className="dialog-actions">
                <Dialog.Close asChild>
                  <button type="button" className="subtle-button">
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
            >
              <X size={17} />
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={commandsOpen} onOpenChange={setCommandsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content
            className="dialog-content command-dialog"
            data-theme={studio.theme}
          >
            <Dialog.Title className="visually-hidden">
              Command palette
            </Dialog.Title>
            <Dialog.Description className="visually-hidden">
              Search and run a studio command.
            </Dialog.Description>
            <div className="command-search">
              <Command size={18} />
              <input
                autoFocus
                aria-label="Search commands"
                placeholder="What would you like to do?"
                value={commandSearch}
                onChange={(event) => setCommandSearch(event.target.value)}
              />
              <Dialog.Close
                className="key-close"
                aria-label="Close command palette"
              >
                esc
              </Dialog.Close>
            </div>
            <div className="command-list">
              {commands.map((command) => (
                <button
                  type="button"
                  key={command.label}
                  disabled={command.disabled || studio.busy}
                  onClick={() => {
                    setCommandsOpen(false);
                    command.run();
                  }}
                >
                  <span>{command.label}</span>
                  {command.shortcut && <kbd>{command.shortcut}</kbd>}
                </button>
              ))}
              {!commands.length && <p>No matching commands.</p>}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={providerOpen} onOpenChange={setProviderOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content" data-theme={studio.theme}>
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
                onClick={() => void studio.refreshProvider()}
              >
                <RefreshCw size={14} /> Check again
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
