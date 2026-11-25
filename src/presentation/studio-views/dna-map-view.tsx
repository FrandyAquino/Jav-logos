import { useMemo, useState, type CSSProperties } from "react";
import {
  Dna,
  GitBranch,
  Link2,
  RotateCcw,
  Check,
  LoaderCircle,
} from "lucide-react";
import { resolveDna } from "../../domain/brand-dna";
import type { Brand, BrandDna } from "../../domain/types";
import { ColorField } from "../property-fields";
import { FontPicker } from "../font-picker";
import { SelectField } from "../select-field";
import type { StudioState } from "../ui";
import { ViewEmpty, ViewHeading } from "./view-primitives";
interface PreviewDraft {
  context: string;
  target: string;
  primary?: string;
  font?: string;
}
function fieldSource(
  brand: Brand,
  key: keyof BrandDna,
  byId: Map<string, Brand>,
): string {
  let current: Brand | undefined = brand;
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.dna[key] !== undefined)
      return current.id === brand.id
        ? "Own rule"
        : `Inherited from ${current.name}`;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return "Brand defaults";
}
function familyNodes(selected: Brand | undefined, brands: Brand[]) {
  if (!selected) return [];
  const map = new Map(brands.map((b) => [b.id, b]));
  let root = selected;
  const seen = new Set<string>();
  while (root.parentId && map.has(root.parentId) && !seen.has(root.id)) {
    seen.add(root.id);
    root = map.get(root.parentId)!;
  }
  const output: { brand: Brand; depth: number }[] = [];
  const queue = [{ brand: root, depth: 0 }];
  while (queue.length) {
    const item = queue.shift()!;
    output.push(item);
    const children = brands.filter((b) => b.parentId === item.brand.id);
    queue.unshift(
      ...children.map((brand) => ({ brand, depth: item.depth + 1 })),
    );
  }
  return output;
}
export function DnaMapView({ studio }: { studio: StudioState }) {
  const selected = studio.selectedBrand;
  const brands = studio.workspace.brands;
  const [draft, setDraft] = useState<PreviewDraft>();
  const [applying, setApplying] = useState(false);
  const [notice, setNotice] = useState("");
  const family = useMemo(
    () => familyNodes(selected, brands),
    [selected, brands],
  );
  const context = selected?.id ?? "";
  const currentDraft = draft?.context === context ? draft : undefined;
  const target = brands.find(
    (b) => b.id === (currentDraft?.target ?? selected?.parentId ?? context),
  );
  const base = useMemo(
    () =>
      new Map(
        family.map(({ brand }) => [brand.id, resolveDna(brand.id, brands)]),
      ),
    [family, brands],
  );
  const targetDna = target ? base.get(target.id) : undefined;
  const patch = useMemo<Partial<BrandDna>>(
    () => ({
      ...(currentDraft?.primary &&
      targetDna &&
      currentDraft.primary !== targetDna.palette[0]
        ? { palette: [currentDraft.primary, ...targetDna.palette.slice(1)] }
        : {}),
      ...(currentDraft?.font &&
      targetDna &&
      currentDraft.font !== targetDna.typography
        ? { typography: currentDraft.font }
        : {}),
    }),
    [currentDraft, targetDna],
  );
  const dirty = Object.keys(patch).length > 0;
  const previewBrands = useMemo(
    () =>
      dirty
        ? brands.map((brand) =>
            brand.id === target?.id
              ? { ...brand, dna: { ...brand.dna, ...patch } }
              : brand,
          )
        : brands,
    [brands, dirty, patch, target?.id],
  );
  const previewMap = useMemo(
    () =>
      new Map(
        family.map(({ brand }) => [
          brand.id,
          resolveDna(brand.id, previewBrands),
        ]),
      ),
    [family, previewBrands],
  );
  const byId = useMemo(
    () => new Map(previewBrands.map((brand) => [brand.id, brand])),
    [previewBrands],
  );
  const affected = family.filter(
    ({ brand }) =>
      JSON.stringify(base.get(brand.id)) !==
      JSON.stringify(previewMap.get(brand.id)),
  ).length;
  const updateDraft = (change: Partial<PreviewDraft>) => {
    setNotice("");
    setDraft({
      ...currentDraft,
      context,
      target: target?.id ?? context,
      ...change,
    });
  };
  const apply = async () => {
    if (!target || !dirty || applying) return;
    setApplying(true);
    setNotice("");
    try {
      if (await studio.updateBrandDna(target.id, patch)) {
        setDraft((previous) =>
          previous?.context === context ? undefined : previous,
        );
        setNotice("Brand rules saved. Existing artwork is unchanged.");
      }
    } finally {
      setApplying(false);
    }
  };
  return (
    <section
      className="exploration-view dna-map-view"
      aria-label="Brand DNA map"
    >
      <ViewHeading
        title="A family with shared DNA"
        description="Trace inherited rules and preview how an ancestor change reaches related brands."
      />
      {!selected || !targetDna || !target ? (
        <ViewEmpty title="Choose a brand family">
          Select a brand to inspect its ancestry and inherited identity.
        </ViewEmpty>
      ) : (
        <>
          <div className="dna-preview-controls">
            <div className="dna-preview-title">
              <Dna size={18} />
              <div>
                <h3>Preview a rule change</h3>
                <p>Preview stays local until you choose Apply.</p>
              </div>
            </div>
            <div className="dna-preview-fields">
              <SelectField
                label="DNA preview target"
                value={target.id}
                disabled={applying}
                onValueChange={(id) => {
                  setDraft({ context, target: id });
                  setNotice("");
                }}
                options={family.map(({ brand }) => ({
                  value: brand.id,
                  label: brand.name,
                }))}
              />
              <ColorField
                label="Preview primary"
                value={currentDraft?.primary ?? targetDna.palette[0]}
                onChange={(primary) => {
                  if (!applying) updateDraft({ primary });
                }}
              />
              <FontPicker
                label="Preview typography"
                value={currentDraft?.font ?? targetDna.typography}
                disabled={applying}
                onValueChange={(font) => updateDraft({ font })}
              />
            </div>
            <div className="dna-preview-actions">
              <p aria-live="polite">
                {dirty
                  ? `${affected} ${affected === 1 ? "brand would change" : "brands would change"}.`
                  : "Choose a color or typeface to see its effect."}
              </p>
              <button
                type="button"
                className="subtle-button"
                disabled={!dirty || applying}
                onClick={() => {
                  setDraft(undefined);
                  setNotice("");
                }}
              >
                <RotateCcw size={14} />
                Reset preview
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={!dirty || applying || studio.busy}
                onClick={() => void apply()}
              >
                {applying ? (
                  <LoaderCircle size={14} className="spin" />
                ) : (
                  <Check size={14} />
                )}
                Apply DNA to {target.name}
              </button>
            </div>
            <p className="exploration-note">
              Only brand rules are updated. Saved logos retain their own colors,
              typography and generation provenance.
            </p>
            {notice && (
              <p className="dna-save-notice" role="status">
                {notice}
              </p>
            )}
          </div>
          <div className="dna-family-map" aria-label="Brand inheritance tree">
            {family.map(({ brand, depth }) => {
              const current = byId.get(brand.id)!;
              const dna = previewMap.get(brand.id)!;
              const before = base.get(brand.id)!;
              const changed = JSON.stringify(before) !== JSON.stringify(dna);
              const parent = brands.find((item) => item.id === brand.parentId);
              return (
                <div
                  className="dna-node-wrap"
                  key={brand.id}
                  style={{ "--dna-depth": Math.min(depth, 5) } as CSSProperties}
                >
                  <article
                    className={`dna-node-card ${brand.id === selected.id ? "selected" : ""} ${changed ? "preview-changed" : ""}`}
                  >
                    <header>
                      <button
                        type="button"
                        disabled={applying}
                        onClick={() => studio.selectBrand(brand.id)}
                        aria-current={
                          brand.id === selected.id ? "page" : undefined
                        }
                      >
                        <GitBranch size={16} />
                        <strong>{brand.name}</strong>
                      </button>
                      <span>
                        {changed
                          ? "Preview"
                          : brand.status === "archived"
                            ? "Archived"
                            : parent
                              ? `Child of ${parent.name}`
                              : "Parent brand"}
                      </span>
                    </header>
                    <dl>
                      <div className="dna-palette-row">
                        <dt>Palette</dt>
                        <dd>
                          <div className="dna-swatches">
                            {dna.palette.map((color, index) => (
                              <span
                                key={`${color}-${index}`}
                                style={{ background: color }}
                                title={color}
                                aria-label={color}
                              />
                            ))}
                          </div>
                          <small>
                            <Link2 size={11} />
                            {fieldSource(current, "palette", byId)}
                          </small>
                        </dd>
                      </div>
                      <div>
                        <dt>Typography</dt>
                        <dd>
                          <span style={{ fontFamily: dna.typography }}>
                            {dna.typography}
                          </span>
                          <small>
                            {fieldSource(current, "typography", byId)}
                          </small>
                        </dd>
                      </div>
                      <div>
                        <dt>Geometry</dt>
                        <dd>
                          <span className="dna-geometry-name">
                            {dna.geometry}
                          </span>
                          <small>
                            {fieldSource(current, "geometry", byId)}
                          </small>
                        </dd>
                      </div>
                      <div className="dna-tone-row">
                        <dt>Personality</dt>
                        <dd>
                          <span>{dna.tone || "No personality rule"}</span>
                          <small>{fieldSource(current, "tone", byId)}</small>
                        </dd>
                      </div>
                    </dl>
                  </article>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
