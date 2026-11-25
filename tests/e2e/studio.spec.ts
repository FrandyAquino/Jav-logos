import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
test("brand inheritance, editable concepts, version recovery and exported kit survive reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Create your first brand" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Brand name")
    .fill("JavCollections");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create brand", exact: true })
    .click();
  await expect(page.getByRole("navigation", { name: "Brands" })).toContainText(
    "JavCollections",
  );
  await page.getByLabel("Brand typography").selectOption("Georgia");
  await page.getByRole("button", { name: "Add sub-brand" }).click();
  await page.getByRole("dialog").getByLabel("Brand name").fill("JavLogos");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create brand", exact: true })
    .click();
  await expect(page.getByLabel("Brand typography")).toHaveValue("Georgia");
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Select .* study/ }),
  ).toHaveCount(4);
  await page.getByRole("tab", { name: "Design", exact: true }).click();
  await page.getByRole("button", { name: "Save current version" }).click();
  await page.getByLabel("Logo wordmark").fill("JAV");
  await page.getByLabel("Logo wordmark").press("Tab");
  await expect(page.getByLabel("Logo wordmark")).toHaveValue("JAV");
  await page.getByRole("button", { name: /Composition versions/ }).click();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.getByLabel("Logo wordmark")).toHaveValue("JavLogos");
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export brand kit", exact: true })
    .click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("JavLogos-brand-kit.zip");
  await download.saveAs("artifacts/e2e-brand-kit.zip");
  const archive = unzipSync(await readFile("artifacts/e2e-brand-kit.zip"));
  const metadata = JSON.parse(strFromU8(archive["brand.json"]));
  expect(metadata.brand.name).toBe("JavLogos");
  expect(metadata.dna.typography).toBe("Georgia");
  expect(
    Object.keys(archive).filter((name) => name.endsWith(".svg")),
  ).toHaveLength(4);
  for (const [name, bytes] of Object.entries(archive)) {
    if (name.endsWith(".png"))
      expect(Array.from(bytes.slice(0, 8))).toEqual([
        137, 80, 78, 71, 13, 10, 26, 10,
      ]);
    if (name.endsWith(".svg")) expect(strFromU8(bytes)).toContain("JavLogos");
  }
  await page.screenshot({ path: "artifacts/studio-dark.png" });
  await page.reload();
  await page
    .getByRole("navigation", { name: "Brands" })
    .getByRole("button", { name: /J JavLogos/ })
    .click();
  await expect(
    page.getByRole("button", { name: /Select .* study/ }),
  ).toHaveCount(4);
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.screenshot({ path: "artifacts/studio-light.png" });
  await page.setViewportSize({ width: 960, height: 720 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Control+k");
  await expect(
    page.getByRole("dialog", { name: "Command palette" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
});
test("PNG export preserves square and portrait SVG proportions", async ({
  page,
}) => {
  await page.goto("/");
  const sizes = await page.evaluate(async () => {
    const modulePath = "/src/infrastructure/export.ts";
    const { rasterize } = await import(modulePath);
    const sizes: number[][] = [];
    for (const [width, height] of [
      [256, 256],
      [200, 400],
    ]) {
      const bytes: Uint8Array = await rasterize(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="red"/></svg>`,
      );
      const view = new DataView(bytes.buffer);
      sizes.push([view.getUint32(16), view.getUint32(20)]);
    }
    return sizes;
  });
  expect(sizes).toEqual([
    [1280, 1280],
    [640, 1280],
  ]);
});

test("failed generation save can be exported and imported without rerunning generation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create your first brand" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Brand name")
    .fill("Recovery Brand");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create brand", exact: true })
    .click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (
        key === "javlogos.workspace.v1" &&
        JSON.parse(value).snapshot.concepts.length
      )
        throw new DOMException("Storage full", "QuotaExceededError");
      original.call(this, key, value);
    };
  });
  await page.getByLabel("Number of concepts").selectOption("2");
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(
    page.getByText("2 generated concepts are waiting to save.", {
      exact: false,
    }),
  ).toBeVisible();
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export recovery copy", exact: true })
    .click();
  const download = await downloading;
  await download.saveAs("artifacts/recovery-batch.json");
  const bytes = await readFile("artifacts/recovery-batch.json");
  const recovery = JSON.parse(bytes.toString());
  expect(recovery.concepts).toHaveLength(2);
  expect(recovery.concepts[0].generationContext.dna).toBeDefined();
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page
    .getByLabel("Recovery copy", { exact: true })
    .setInputFiles({
      name: "recovery.json",
      mimeType: "application/json",
      buffer: bytes,
    });
  await expect(
    page.getByRole("button", { name: /Select .* study/ }),
  ).toHaveCount(2);
  const ids = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem("javlogos.workspace.v1")!,
    ).snapshot.concepts.map((c: { id: string }) => c.id),
  );
  expect(ids).toEqual(recovery.concepts.map((c: { id: string }) => c.id));
});
