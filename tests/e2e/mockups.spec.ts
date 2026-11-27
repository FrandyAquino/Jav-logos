import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { chooseOption } from "./controls";
import AxeBuilder from "@axe-core/playwright";
async function openStudio(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Create your first brand" }).click();
  await page.getByRole("dialog").getByLabel("Brand name").fill("NOVA");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create brand", exact: true })
    .click();
  await chooseOption(page, "Brand typography", "Manrope");
  await chooseOption(page, "Number of concepts", "1 concept");
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Select Orbit study", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("group", { name: "Studio tools" })
    .getByRole("button", { name: "Mockups", exact: true })
    .click();
}
test("all14 3D scenes render the actual logo; camera, materials and PNG export preserve the saved design", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openStudio(page);
  const canvas = page.getByRole("img", {
    name: "Interactive 3D mockup",
    exact: true,
  });
  await expect(canvas).toHaveAttribute("data-scene", "card", {
    timeout: 30000,
  });
  const snapshot = () =>
    page.evaluate(
      () => JSON.parse(localStorage.getItem("javlogos.workspace.v1")!).snapshot,
    );
  await expect(canvas).toHaveAttribute("data-lighting", "hdr", {
    timeout: 30000,
  });
  const before = await snapshot();
  const hashes = new Set<string>();
  const scenes = [
    ["card", "Business cards"],
    ["stationery", "Stationery"],
    ["package", "Rigid box"],
    ["mailer", "Kraft mailer"],
    ["bag", "Shopping bag"],
    ["tote", "Cotton tote"],
    ["shirt", "Folded T-shirt"],
    ["mug", "Ceramic mug"],
    ["bottle", "Water bottle"],
    ["cup", "Takeaway cup"],
    ["sign", "Office plaque"],
    ["round-sign", "Shop sign"],
    ["web", "Laptop"],
    ["app", "Phone"],
  ];
  for (const [id, name] of scenes) {
    await page
      .getByRole("group", { name: "Application template" })
      .getByRole("button", { name: new RegExp(`^${name}`) })
      .click();
    await expect(canvas).toHaveAttribute("data-scene", id);
    const data = await canvas.evaluate((el: HTMLCanvasElement) =>
      el.toDataURL("image/png"),
    );
    expect(data.length).toBeGreaterThan(15000);
    hashes.add(data.slice(-2000));
    await page.screenshot({ path: `artifacts/mockup-3d-${id}.png` });
  }
  expect(hashes.size).toBe(14);
  await page
    .getByRole("group", { name: "Application template" })
    .getByRole("button", { name: /^Business cards/ })
    .click();
  await expect(canvas).toHaveAttribute("data-scene", "card");
  const initial = await canvas.evaluate((el: HTMLCanvasElement) =>
    el.toDataURL(),
  );
  await page
    .getByRole("button", { name: "Zoom in mockup", exact: true })
    .click();
  await expect
    .poll(() =>
      canvas.evaluate(
        (el: HTMLCanvasElement, before) => el.toDataURL() !== before,
        initial,
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Reset mockup camera" }).click();
  await chooseOption(page, "Mockup print finish", "Gold foil");
  await expect(page.getByText(/Gold foil uses/)).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export mockup PNG" }).click();
  await (await download).saveAs("artifacts/mockup-3d-export.png");
  const bytes = await readFile("artifacts/mockup-3d-export.png");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  expect(Math.max(view.getUint32(16), view.getUint32(20))).toBe(2048);
  expect(Array.from(bytes.subarray(0, 8))).toEqual([
    137, 80, 78, 71, 13, 10, 26, 10,
  ]);
  expect(bytes.length).toBeGreaterThan(20000);
  expect(await snapshot()).toEqual(before);
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    );
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 960, height: 720 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "artifacts/mockup-3d-compact-light.png" });
  for (let i = 0; i < 3; i++) {
    await page
      .getByRole("button", { name: "Canvas view", exact: true })
      .click();
    await page
      .getByRole("group", { name: "Studio tools" })
      .getByRole("button", { name: "Mockups", exact: true })
      .click();
    await expect(page.locator(".mockup-render-stage")).toHaveAttribute(
      "data-render-state",
      "ready",
    );
  }
  expect(errors).toEqual([]);
});

test("explicit mockup changes still render when animation frames are suspended", async ({
  page,
}) => {
  await openStudio(page);
  const canvas = page.getByRole("img", {
    name: "Interactive 3D mockup",
    exact: true,
  });
  await expect(canvas).toHaveAttribute("data-scene", "card", {
    timeout: 30000,
  });
  await page.evaluate(() => {
    window.requestAnimationFrame = () => 0;
  });
  await page
    .getByRole("group", { name: "Application template" })
    .getByRole("button", { name: /^Ceramic mug/ })
    .dispatchEvent("click");
  await expect(canvas).toHaveAttribute("data-scene", "mug");
  const before = await canvas.evaluate((el: HTMLCanvasElement) =>
    el.toDataURL(),
  );
  await page
    .getByRole("button", { name: "Zoom in mockup", exact: true })
    .dispatchEvent("click");
  await expect
    .poll(() => canvas.evaluate((el: HTMLCanvasElement) => el.toDataURL()))
    .not.toBe(before);
});
test("missing WebGL shows an honest fallback and prevents empty mockup exports", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      type: string,
      ...args: unknown[]
    ) {
      if (type === "webgl2") return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await openStudio(page);
  await expect(page.getByRole("alert")).toContainText("WebGL 2");
  await expect(
    page.getByRole("img", { name: "Flat artwork fallback" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Export mockup PNG" }),
  ).toBeDisabled();
});

test("mockup artwork preserves pixels and makes composition background an explicit preview choice", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const vectorPath = "/src/domain/vector.ts",
      dnaPath = "/src/domain/brand-dna.ts",
      artPath = "/src/infrastructure/mockups/artwork.ts";
    const { generateConcepts } = await import(vectorPath),
      { DEFAULT_DNA } = await import(dnaPath),
      { prepareMockupArtwork } = await import(artPath);
    const concept = generateConcepts(
      "brand",
      "Nova",
      "mark",
      { ...DEFAULT_DNA, typography: "Manrope" },
      1,
      42,
    )[0];
    concept.document.transparentBackground = true;
    const before = JSON.stringify(concept);
    const canvas = await prepareMockupArtwork(concept, "composition", true);
    const transparent = await prepareMockupArtwork(
      concept,
      "composition",
      false,
    );
    const image = document.createElement("canvas");
    image.width = image.height = 20;
    const ctx = image.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 20, 20);
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(5, 5, 10, 10);
    concept.raster = image.toDataURL("image/png");
    const original = await prepareMockupArtwork(concept, "original", false);
    const pixels = Array.from(
      original.getContext("2d")!.getImageData(0, 0, 20, 20).data,
    );
    return {
      bgAlpha: canvas.getContext("2d")!.getImageData(0, 0, 1, 1).data[3],
      transparentAlpha: transparent.getContext("2d")!.getImageData(0, 0, 1, 1)
        .data[3],
      unchanged: JSON.stringify({ ...concept, raster: undefined }) === before,
      original: Array.from(
        original.getContext("2d")!.getImageData(0, 0, 1, 1).data,
      ),
      red: pixels.filter(
        (_: number, i: number) =>
          i % 4 === 0 && pixels[i] === 255 && pixels[i + 1] === 0,
      ).length,
    };
  });
  expect(result.bgAlpha).toBe(255);
  expect(result.transparentAlpha).toBe(0);
  expect(result.unchanged).toBe(true);
  expect(result.original).toEqual([255, 255, 255, 255]);
  expect(result.red).toBe(100);
});

test("a lost graphics context can recover without losing the concept", async ({
  page,
}) => {
  await openStudio(page);
  const canvas = page.getByRole("img", {
    name: "Interactive 3D mockup",
    exact: true,
  });
  await expect(canvas).toHaveAttribute("data-scene", "card", {
    timeout: 30000,
  });
  await canvas.evaluate((element: HTMLCanvasElement) =>
    element
      .getContext("webgl2")!
      .getExtension("WEBGL_lose_context")!
      .loseContext(),
  );
  await expect(page.getByRole("alert")).toContainText(
    "graphics context was lost",
  );
  await expect(
    page.getByRole("button", { name: "Export mockup PNG" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Retry 3D preview" }).click();
  await expect(canvas).toHaveAttribute("data-scene", "card", {
    timeout: 30000,
  });
  await expect(
    page.getByRole("button", { name: "Export mockup PNG" }),
  ).toBeEnabled();
  const count = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("javlogos.workspace.v1")!).snapshot
        .concepts.length,
  );
  expect(count).toBe(1);
});
