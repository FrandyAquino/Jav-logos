import { expect, it } from "vitest";
import { MOCKUP_SCENES, mockupScene, validateMockupSettings } from "./mockups";
it("provides distinct offline scenes and bounds presentation controls", () => {
  expect(new Set(MOCKUP_SCENES.map((scene) => scene.id)).size).toBe(14);
  for (const scene of MOCKUP_SCENES)
    expect(() =>
      validateMockupSettings({
        scene: scene.id,
        surface: scene.color,
        backdrop: "warm",
        finish: "ink",
        scale: 1,
        offsetX: 0,
        offsetY: 0,
      }),
    ).not.toThrow();
  expect(() => mockupScene("https://external.invalid/scene")).toThrow();
  expect(() =>
    validateMockupSettings({
      scene: "mug",
      surface: "#ffffff",
      backdrop: "warm",
      finish: "ink",
      scale: Infinity,
      offsetX: 0,
      offsetY: 0,
    }),
  ).toThrow();
});
