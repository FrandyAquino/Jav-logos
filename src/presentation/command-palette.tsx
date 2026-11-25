import { useEffect, useId, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Search } from "lucide-react";

export interface StudioCommand {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  opensDialog?: boolean;
  run: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  theme,
  commands,
  returnFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme: "light" | "dark";
  commands: StudioCommand[];
  returnFocus: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const listId = useId();
  const handingOffFocus = useRef(false);
  const visible = commands.filter((command) =>
    command.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const enabled = visible.filter((command) => !command.disabled);
  const selected =
    enabled.find((command) => command.label === selectedLabel) ?? enabled[0];
  const activeId = selected
    ? `${listId}-${visible.indexOf(selected)}`
    : undefined;

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedLabel(null);
    }
  }, [open]);
  useEffect(() => {
    if (open && activeId)
      document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" });
  }, [open, activeId]);

  const run = (command: StudioCommand) => {
    if (command.disabled) return;
    handingOffFocus.current = Boolean(command.opensDialog);
    onOpenChange(false);
    command.run();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog-content command-dialog"
          data-theme={theme}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!handingOffFocus.current) returnFocus();
            handingOffFocus.current = false;
          }}
        >
          <Dialog.Title className="visually-hidden">
            Command palette
          </Dialog.Title>
          <Dialog.Description className="visually-hidden">
            Search commands. Use the arrow keys to choose a command and Enter to
            run it.
          </Dialog.Description>
          <div className="command-search">
            <Search size={18} aria-hidden="true" />
            <input
              autoFocus
              aria-label="Search commands"
              placeholder="Search commands…"
              role="combobox"
              aria-expanded="true"
              aria-autocomplete="list"
              aria-controls={listId}
              aria-activedescendant={activeId}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedLabel(null);
              }}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                if (
                  ["ArrowDown", "ArrowUp"].includes(event.key) &&
                  enabled.length
                ) {
                  event.preventDefault();
                  const index = selected ? enabled.indexOf(selected) : 0;
                  const next =
                    (index +
                      (event.key === "ArrowDown" ? 1 : -1) +
                      enabled.length) %
                    enabled.length;
                  setSelectedLabel(enabled[next].label);
                } else if (event.key === "Enter" && selected) {
                  event.preventDefault();
                  run(selected);
                }
              }}
            />
            <Dialog.Close
              className="key-close"
              aria-label="Close command palette"
            >
              Esc
            </Dialog.Close>
          </div>
          <div
            id={listId}
            className="command-list"
            role="listbox"
            aria-label="Studio commands"
          >
            {visible.map((command, index) => (
              <button
                type="button"
                role="option"
                id={`${listId}-${index}`}
                key={command.label}
                tabIndex={-1}
                disabled={command.disabled}
                aria-disabled={command.disabled || undefined}
                aria-selected={command === selected}
                onPointerMove={() => {
                  if (!command.disabled) setSelectedLabel(command.label);
                }}
                onClick={() => run(command)}
              >
                <span>{command.label}</span>
                {command.shortcut && <kbd>{command.shortcut}</kbd>}
              </button>
            ))}
          </div>
          {!visible.length && (
            <p className="command-empty" role="status">
              No commands match “{query}”. Try a different search.
            </p>
          )}
          <div className="command-hint">
            <span>
              <kbd>↑ ↓</kbd> Navigate
            </span>
            <span>
              <kbd>Enter</kbd> Run
            </span>
            <span>
              <kbd>Esc</kbd> Close
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
