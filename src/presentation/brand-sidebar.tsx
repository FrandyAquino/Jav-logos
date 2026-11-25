import { useRef, useState, type DragEvent } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Archive,
  ArrowUp,
  ArrowDown,
  Check,
  CheckCheck,
  Diamond,
  Flower2,
  FolderTree,
  Grid3X3,
  Layers3,
  MoreHorizontal,
  Orbit,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Triangle,
  Type,
  Waves,
  X,
} from "lucide-react";
import type { Brand } from "../domain/types";
import { pinnedBrands } from "../domain/brand-library";
import { IconButton, type StudioState } from "./ui";
const icons = {
  diamond: Diamond,
  orbit: Orbit,
  flower: Flower2,
  type: Type,
  triangle: Triangle,
  waves: Waves,
  grid: Grid3X3,
  layers: Layers3,
  spark: Sparkles,
};
const shapeIcons: Record<string, NonNullable<Brand["icon"]>> = {
  petal: "flower",
  monogram: "type",
  prism: "triangle",
  wave: "waves",
  orbit: "orbit",
  grid: "grid",
};
const iconFor = (brand: Brand) =>
  brand.icon ??
  shapeIcons[brand.dna.geometry ?? ""] ??
  (brand.parentId ? "layers" : "diamond");
const dragType = "application/x-javlogos-brand";
export function BrandSidebar({
  studio,
  onCreate,
}: {
  studio: StudioState;
  onCreate: (parent?: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"active" | "completed" | "archived">(
    "active",
  );
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [renaming, setRenaming] = useState<Brand | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const renameOrigin = useRef<HTMLButtonElement | null>(null);
  const openingRename = useRef(false);
  const brands = studio.workspace.brands;
  const matches = (b: Brand) =>
    b.name.toLowerCase().includes(search.toLowerCase());
  const pinnedOrder = pinnedBrands(brands);
  const pinned = pinnedOrder.filter(matches);
  const visible = brands.filter(
    (b) =>
      matches(b) &&
      (view === "active"
        ? (b.status ?? "active") === "active" && !b.pinned
        : view === "completed"
          ? b.status === "completed" && !b.pinned
          : b.status === "archived"),
  );
  const drop = (event: DragEvent, beforeId?: string) => {
    event.preventDefault();
    const id = event.dataTransfer.getData(dragType);
    if (brands.some((b) => b.id === id && b.status !== "archived"))
      void studio.reorderPinnedBrand(id, beforeId);
    setDragging(null);
    setOver(false);
  };
  const row = (brand: Brand) => {
    const position = pinnedOrder.findIndex((b) => b.id === brand.id);
    const Icon = icons[iconFor(brand) ?? "diamond"];
    const parent = brands.find((b) => b.id === brand.parentId);
    return (
      <div
        className={`library-row ${brand.id === studio.selectedBrand?.id ? "selected" : ""} ${dragging === brand.id ? "dragging" : ""}`}
        key={brand.id}
        data-brand-id={brand.id}
        draggable={brand.status !== "archived"}
        onDragStart={(event) => {
          event.dataTransfer.setData(dragType, brand.id);
          event.dataTransfer.effectAllowed = "move";
          setDragging(brand.id);
        }}
        onDragEnd={() => {
          setDragging(null);
          setOver(false);
        }}
        onDragOver={(event) => {
          if (dragging && brand.pinned) event.preventDefault();
        }}
        onDrop={(event) => {
          if (brand.pinned) {
            event.stopPropagation();
            drop(event, brand.id);
          }
        }}
      >
        <button
          type="button"
          className="library-select"
          aria-label={`Open ${brand.name}`}
          aria-current={
            brand.id === studio.selectedBrand?.id ? "page" : undefined
          }
          onClick={() => studio.selectBrand(brand.id)}
          title={brand.name}
        >
          <span className="library-symbol">
            <Icon size={18} />
          </span>
          <span className="library-copy">
            <span>{brand.name}</span>
            {parent && <small>{parent.name}</small>}
          </span>
          {brand.status === "completed" && (
            <Check
              size={13}
              className="library-complete"
              aria-label="Completed"
            />
          )}
          {brand.pinned && <Pin size={12} aria-label="Pinned" />}
        </button>
        <Menu.Root>
          <Menu.Trigger asChild>
            <button
              className="library-menu-trigger"
              type="button"
              aria-label={`Actions for ${brand.name}`}
            >
              <MoreHorizontal size={16} />
            </button>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content
              className="library-menu"
              data-theme={studio.theme}
              sideOffset={5}
              collisionPadding={10}
              onCloseAutoFocus={(event) => {
                if (openingRename.current) event.preventDefault();
              }}
            >
              <Menu.Label className="library-menu-label">
                {brand.name}
              </Menu.Label>
              <Menu.Item
                className="library-menu-item"
                onSelect={() => {
                  renameOrigin.current =
                    document.querySelector<HTMLButtonElement>(
                      `[data-brand-id="${brand.id}"] .library-menu-trigger`,
                    );
                  openingRename.current = true;
                  setName(brand.name);
                  setRenaming(brand);
                }}
              >
                <Type size={14} />
                Rename
              </Menu.Item>
              {brand.status !== "archived" && (
                <Menu.Item
                  className="library-menu-item"
                  onSelect={() => void studio.pinBrand(brand.id, !brand.pinned)}
                >
                  {brand.pinned ? <PinOff size={14} /> : <Pin size={14} />}{" "}
                  {brand.pinned ? "Unpin" : "Pin to top"}
                </Menu.Item>
              )}
              {brand.pinned && brand.status !== "archived" && (
                <>
                  <Menu.Item
                    className="library-menu-item"
                    disabled={position <= 0}
                    onSelect={() =>
                      void studio.reorderPinnedBrand(
                        brand.id,
                        pinnedOrder[position - 1]?.id,
                      )
                    }
                  >
                    <ArrowUp size={14} />
                    Move up
                  </Menu.Item>
                  <Menu.Item
                    className="library-menu-item"
                    disabled={
                      position < 0 || position === pinnedOrder.length - 1
                    }
                    onSelect={() =>
                      void studio.reorderPinnedBrand(
                        brand.id,
                        pinnedOrder[position + 2]?.id,
                      )
                    }
                  >
                    <ArrowDown size={14} />
                    Move down
                  </Menu.Item>
                </>
              )}
              <Menu.Item
                className="library-menu-item"
                onSelect={() =>
                  void studio.updateBrand(brand.id, {
                    status:
                      brand.status === "completed" ||
                      brand.status === "archived"
                        ? "active"
                        : "completed",
                  })
                }
              >
                <CheckCheck size={14} />
                {brand.status === "archived"
                  ? "Restore brand"
                  : brand.status === "completed"
                    ? "Mark active"
                    : "Mark completed"}
              </Menu.Item>
              {brand.status !== "archived" && (
                <Menu.Item
                  className="library-menu-item"
                  onSelect={() =>
                    void studio.updateBrand(brand.id, { status: "archived" })
                  }
                >
                  <Archive size={14} />
                  Archive
                </Menu.Item>
              )}
              <Menu.Separator className="library-menu-separator" />
              <Menu.Sub>
                <Menu.SubTrigger className="library-menu-item">
                  <Diamond size={14} />
                  Change icon
                </Menu.SubTrigger>
                <Menu.Portal>
                  <Menu.SubContent
                    className="library-menu"
                    data-theme={studio.theme}
                    sideOffset={5}
                  >
                    {Object.entries(icons).map(([key, Option]) => (
                      <Menu.Item
                        className="library-menu-item"
                        key={key}
                        onSelect={() =>
                          void studio.updateBrand(brand.id, {
                            icon: key as Brand["icon"],
                          })
                        }
                      >
                        <Option size={15} />
                        {key[0].toUpperCase() + key.slice(1)}
                        {iconFor(brand) === key && <Check size={12} />}
                      </Menu.Item>
                    ))}
                  </Menu.SubContent>
                </Menu.Portal>
              </Menu.Sub>
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
      </div>
    );
  };
  return (
    <aside className="brand-sidebar panel" aria-label="Brand library">
      <div className="panel-title">
        <span>Brand library</span>
        <IconButton label="Create brand" onClick={() => onCreate()}>
          <Plus size={16} />
        </IconButton>
      </div>
      <label className="search-field">
        <Search size={14} />
        <input
          aria-label="Search brands"
          placeholder="Find a brand…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <nav className="brand-tree" aria-label="Brands">
        <section
          className={`pin-zone ${over ? "over" : ""} ${dragging ? "accepting" : ""}`}
          aria-label="Pinned brands"
          onDragOver={(event) => {
            if (dragging) {
              event.preventDefault();
              setOver(true);
            }
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node))
              setOver(false);
          }}
          onDrop={(event) => drop(event)}
        >
          <div className="library-section-heading">
            <Pin size={13} />
            <span>Pinned</span>
            <span>{pinned.length}</span>
          </div>
          {pinned.map(row)}
          {!pinned.length && (
            <p className="pin-hint">
              {dragging
                ? "Drop here to pin"
                : "Drag a brand here to pin it, or use its menu."}
            </p>
          )}
        </section>
        <div className="library-filters" role="group" aria-label="Brand status">
          {(["active", "completed", "archived"] as const).map((status) => (
            <button
              type="button"
              key={status}
              aria-pressed={view === status}
              onClick={() => setView(status)}
            >
              {status === "active"
                ? "Active"
                : status === "completed"
                  ? "Completed"
                  : "Archived"}
            </button>
          ))}
        </div>
        <div className="library-section-heading">
          <FolderTree size={13} />
          <span>
            {view === "active"
              ? "Brand families"
              : view === "completed"
                ? "Completed"
                : "Archive"}
          </span>
          <span>{visible.length}</span>
        </div>
        {visible.map(row)}
        {!visible.length && (
          <p className="sidebar-empty">
            {search
              ? "No matching brands."
              : view === "archived"
                ? "Archived brands stay here until you restore them."
                : view === "completed"
                  ? "Finished identities will appear here."
                  : pinned.length
                    ? "Your active brands are pinned above."
                    : "Create your first brand to begin."}
          </p>
        )}
      </nav>
      {studio.selectedBrand && (
        <button
          type="button"
          className="subtle-button add-subbrand"
          onClick={() => onCreate(studio.selectedBrand?.id)}
        >
          <Plus size={14} />
          Add sub-brand
        </button>
      )}
      <div className="sidebar-bottom">
        <div className="local-note">
          <RotateCcw size={13} />
          <span>Archived work can be restored</span>
        </div>
      </div>
      <Dialog.Root
        open={Boolean(renaming)}
        onOpenChange={(open) => {
          if (!open && !saving) setRenaming(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content
            className="dialog-content"
            data-theme={studio.theme}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              openingRename.current = false;
              if (renameOrigin.current?.isConnected)
                renameOrigin.current.focus();
              else
                document
                  .querySelector<HTMLInputElement>(
                    ".brand-sidebar .search-field input",
                  )
                  ?.focus();
            }}
          >
            <Dialog.Title>Rename brand</Dialog.Title>
            <Dialog.Description>
              Change the library name. Saved artwork and ancestry stay intact.
            </Dialog.Description>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                if (!renaming || saving) return;
                setSaving(true);
                try {
                  if (await studio.updateBrand(renaming.id, { name }))
                    setRenaming(null);
                } finally {
                  setSaving(false);
                }
              }}
            >
              <label className="dialog-field">
                Brand name
                <input
                  aria-label="New brand name"
                  autoFocus
                  value={name}
                  maxLength={120}
                  onChange={(event) => setName(event.target.value)}
                  disabled={saving}
                />
              </label>
              {studio.error && (
                <p role="alert" className="dialog-error">
                  {studio.error}
                </p>
              )}
              <div className="dialog-actions">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="subtle-button"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={!name.trim() || saving}
                >
                  {saving ? "Saving…" : "Save name"}
                </button>
              </div>
            </form>
            <Dialog.Close
              className="dialog-close"
              disabled={saving}
              aria-label="Close rename dialog"
            >
              <X size={17} />
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </aside>
  );
}
