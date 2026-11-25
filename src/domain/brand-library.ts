import type { Brand } from "./types";
export function pinnedBrands(brands: Brand[]): Brand[] {
  return brands
    .filter((b) => b.pinned && b.status !== "archived")
    .sort(
      (a, b) =>
        (a.order ?? 0) - (b.order ?? 0) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    );
}
export function reorderPinned(
  brands: Brand[],
  id: string,
  beforeId?: string,
): Brand[] {
  const brand = brands.find((b) => b.id === id);
  if (!brand) throw new Error("Brand not found.");
  if (brand.status === "archived")
    throw new Error("Restore this brand before pinning it.");
  if (beforeId === id) return brands;
  const ids = pinnedBrands(brands)
    .map((b) => b.id)
    .filter((candidate) => candidate !== id);
  const index = beforeId ? ids.indexOf(beforeId) : -1;
  ids.splice(index < 0 ? ids.length : index, 0, id);
  return brands.map((b) => {
    const order = ids.indexOf(b.id);
    return order >= 0 ? { ...b, pinned: true, order } : b;
  });
}
