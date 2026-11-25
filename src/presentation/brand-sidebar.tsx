import { useState } from "react";
import { FolderTree, Layers3, Plus, Search, ShieldCheck } from "lucide-react";
import type { Brand } from "../domain/types";
import { IconButton, type StudioState } from "./ui";

export function BrandSidebar({
  studio,
  onCreate,
}: {
  studio: StudioState;
  onCreate: (parent?: string) => void;
}) {
  const [search, setSearch] = useState("");
  const brands = studio.workspace.brands;
  const depth = (brand: Brand) => {
    let parent = brand.parentId;
    let count = 0;
    const seen = new Set([brand.id]);
    while (parent && !seen.has(parent)) {
      seen.add(parent);
      count++;
      parent =
        brands.find((candidate) => candidate.id === parent)?.parentId ?? null;
    }
    return Math.min(count, 6);
  };
  const ordered: Brand[] = [];
  const visit = (parent: string | null) => {
    for (const brand of brands.filter((item) => item.parentId === parent)) {
      if (ordered.some((item) => item.id === brand.id)) continue;
      ordered.push(brand);
      visit(brand.id);
    }
  };
  visit(null);
  for (const brand of brands)
    if (!ordered.some((item) => item.id === brand.id)) ordered.push(brand);
  const visible = ordered.filter((brand) =>
    brand.name.toLowerCase().includes(search.toLowerCase()),
  );

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
      <div className="sidebar-section-label">
        <FolderTree size={13} /> Brand families <span>{brands.length}</span>
      </div>
      <nav className="brand-tree" aria-label="Brands">
        {visible.map((brand) => (
          <button
            type="button"
            key={brand.id}
            className={`brand-row ${brand.id === studio.selectedBrand?.id ? "selected" : ""}`}
            style={{ paddingLeft: 12 + depth(brand) * 14 }}
            onClick={() => studio.selectBrand(brand.id)}
            title={brand.name}
            aria-current={
              brand.id === studio.selectedBrand?.id ? "page" : undefined
            }
          >
            {brands.some((item) => item.parentId === brand.id) ? (
              <FolderTree className="tree-chevron" size={12} />
            ) : (
              <span className="tree-dot" />
            )}
            <span
              className="brand-avatar"
              style={{
                background: brand.dna.palette?.[0],
                color: brand.dna.palette?.[0]
                  ? avatarTextColor(brand.dna.palette[0])
                  : undefined,
              }}
            >
              {brand.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="brand-name">{brand.name}</span>
            {brand.parentId && (
              <span className="child-indicator" title="Inherits Brand DNA" />
            )}
          </button>
        ))}
        {!visible.length && (
          <div className="sidebar-empty">
            {search ? "No matching brands." : "Your next identity starts here."}
          </div>
        )}
      </nav>
      {studio.selectedBrand && (
        <button
          type="button"
          className="subtle-button add-subbrand"
          onClick={() => onCreate(studio.selectedBrand?.id)}
        >
          <Plus size={14} /> Add sub-brand
        </button>
      )}
      <div className="sidebar-bottom">
        <div className="dna-note">
          <Layers3 size={19} />
          <strong>Shared Brand DNA</strong>
          <p>
            Sub-brands inherit a palette, typeface and visual direction.
            Override any field when they need their own identity.
          </p>
        </div>
        <div className="local-note">
          <ShieldCheck size={13} />
          <span>
            {studio.native ? "Stored on this device" : "Stored in this browser"}
          </span>
        </div>
      </div>
    </aside>
  );
}

function avatarTextColor(color: string): string {
  const channels = [1, 3, 5]
    .map((start) => parseInt(color.slice(start, start + 2), 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  const luminance =
    0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return luminance > 0.179 ? "#000000" : "#ffffff";
}
