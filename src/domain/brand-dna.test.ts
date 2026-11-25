import { describe, expect, it } from "vitest";
import { resolveDna, analyzeConsistency, validateHierarchy } from "./brand-dna";
import type { Brand } from "./types";
const parent: Brand = {
  id: "parent",
  name: "Collection",
  parentId: null,
  dna: { palette: ["#123456"], typography: "Georgia" },
  createdAt: "2026-11-25",
};
const child: Brand = {
  id: "child",
  name: "Logos",
  parentId: "parent",
  dna: { tone: "expressive" },
  createdAt: "2026-11-25",
};
describe("Brand DNA", () => {
  it("inherits through multiple generations while preserving explicit overrides", () => {
    const leaf: Brand = {
      ...child,
      id: "leaf",
      parentId: "child",
      dna: { palette: ["#abcdef"] },
    };
    expect(resolveDna("leaf", [parent, child, leaf])).toMatchObject({
      palette: ["#abcdef"],
      typography: "Georgia",
      tone: "expressive",
    });
    expect(resolveDna("child", [parent, child]).palette).toEqual(["#123456"]);
  });
  it("rejects missing parents and cycles instead of silently inventing ancestry", () => {
    expect(() => validateHierarchy([child])).toThrow(/parent/i);
    expect(() =>
      validateHierarchy([{ ...parent, parentId: "child" }, child]),
    ).toThrow(/cycle/i);
  });
  it("measures explicit document deviations with understandable reasons", () => {
    const report = analyzeConsistency("child", [parent, child], {
      shape: "orbit",
      text: "Logos",
      primary: "#ff0000",
      background: "#ffffff",
      fontFamily: "Courier New",
      scale: 1,
      rotation: 0,
      letterSpacing: 0,
      strokeWidth: 0,
    });
    expect(report.score).toBeLessThan(100);
    expect(report.issues.join(" ")).toMatch(/palette/i);
    expect(report.issues.join(" ")).toMatch(/typography/i);
  });
});
