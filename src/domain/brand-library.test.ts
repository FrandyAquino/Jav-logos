import { expect, it } from "vitest";
import { pinnedBrands, reorderPinned } from "./brand-library";
import type { Brand } from "./types";
const brands: Brand[] = [
  { id: "parent", name: "Family", parentId: null, dna: {}, createdAt: "1" },
  { id: "child", name: "Child", parentId: "parent", dna: {}, createdAt: "2" },
];
it("pins and reorders without changing ancestry or losing identity", () => {
  let next = reorderPinned(brands, "parent");
  next = reorderPinned(next, "child", "parent");
  expect(pinnedBrands(next).map((b) => b.id)).toEqual(["child", "parent"]);
  expect(next.find((b) => b.id === "child")?.parentId).toBe("parent");
  expect(brands.some((b) => b.pinned)).toBe(false);
  expect(
    pinnedBrands(reorderPinned(next, "child", "child")).map((b) => b.id),
  ).toEqual(["child", "parent"]);
});
it("keeps archived brands out of pinned view without deleting them", () => {
  const archived: Brand[] = [
    { ...brands[0], status: "archived", pinned: true },
    brands[1],
  ];
  expect(pinnedBrands(archived)).toHaveLength(0);
  expect(() => reorderPinned(archived, "parent")).toThrow(/Restore/);
});
