import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { strFromU8, unzipSync } from "fflate";
import { chooseOption } from "./controls";
test("fitted, transparent and outlined variants export actual portable artwork", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Create your first brand" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Brand name")
    .fill("JavCollections Architecture and Creative Technology");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create brand", exact: true })
    .click();
  await chooseOption(page, "Brand typography", "Manrope");
  await chooseOption(page, "Number of concepts", "1 concept");
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await page.getByRole("tab", { name: "Design", exact: true }).click();
  await chooseOption(page, "Logo arrangement", "Horizontal");
  await page
    .getByLabel("Logo slogan", { exact: true })
    .fill(
      "Diseño, tecnología y una identidad compartida para nuestras herramientas",
    );
  await page.getByLabel("Logo slogan", { exact: true }).press("Tab");
  await page.getByLabel("Auto-fit name and slogan", { exact: true }).check();
  await page.getByLabel("Transparent canvas", { exact: true }).check();
  const snapshot = () =>
    page.evaluate(
      () => JSON.parse(localStorage.getItem("javlogos.workspace.v1")!).snapshot,
    );
  await expect
    .poll(async () => (await snapshot()).concepts[0].document.wordmarkFit)
    .toBeLessThan(1);
  const bounds = await page.locator(".main-artwork svg").evaluate((svg) => {
    const outer = svg.getBoundingClientRect();
    return Array.from(svg.querySelectorAll("text")).every((text) => {
      const box = text.getBoundingClientRect();
      return (
        box.left >= outer.left &&
        box.right <= outer.right + 1 &&
        box.top >= outer.top &&
        box.bottom <= outer.bottom
      );
    });
  });
  expect(bounds).toBe(true);
  const before = await snapshot();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Outlined SVG", exact: true }).click();
  await (await downloadEvent).saveAs("artifacts/delivery-outlined.svg");
  const svg = await readFile("artifacts/delivery-outlined.svg", "utf8");
  expect(svg).not.toContain("<text");
  expect(svg).not.toContain("data:font/");
  expect(svg).toContain("<path");
  await page
    .getByRole("button", { name: "Logo variants", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Export logo variants" });
  await expect(
    dialog.getByRole("button", { name: "Export variants ZIP" }),
  ).toBeEnabled({ timeout: 30000 });
  await expect(dialog.getByRole("img")).toHaveCount(5);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({ path: "artifacts/delivery-variants-dark.png" });
  const kitDownload = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export variants ZIP" }).click();
  await (await kitDownload).saveAs("artifacts/delivery-variants.zip");
  const files = unzipSync(await readFile("artifacts/delivery-variants.zip"));
  expect(
    Object.keys(files).filter((name) => name.endsWith(".svg")),
  ).toHaveLength(5);
  for (const name of ["stacked", "horizontal", "black", "white", "icon"])
    expect(strFromU8(files[`${name}.svg`])).not.toContain("<text");
  for (const size of [16, 32, 48]) {
    const bytes = files[`favicon-${size}.png`];
    const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect([data.getUint32(16), data.getUint32(20)]).toEqual([size, size]);
  }
  const alpha = await page.evaluate(async (bytes) => {
    const image = await createImageBitmap(
      new Blob([new Uint8Array(bytes)], { type: "image/png" }),
    );
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    return {
      corner: data[3],
      ink: data.some((value, i) => i % 4 === 3 && value > 0),
    };
  }, Array.from(files["horizontal.png"]));
  expect(alpha).toEqual({ corner: 0, ink: true });
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  expect(await snapshot()).toEqual(before);
  await page.reload();
  expect((await snapshot()).concepts[0].document.autoFitText).toBe(true);
  expect(errors).toEqual([]);
});

test("background preview saves an independent cutout, preserves original and survives reload", async ({
  page,
}) => {
  await page.goto("/");
  const fixture = await page.evaluate(async () => {
    const modulePath = "/src/domain/vector.ts";
    const { generateConcepts } = await import(modulePath);
    const dnaPath = "/src/domain/brand-dna.ts";
    const { DEFAULT_DNA } = await import(dnaPath);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = "#2457ff";
    ctx.fillRect(32, 32, 64, 64);
    ctx.fillStyle = "white";
    ctx.fillRect(48, 48, 32, 32);
    const brandId = "cutout-test";
    const concept = generateConcepts(
      brandId,
      "Cutout",
      "fixture",
      { ...DEFAULT_DNA, typography: "Manrope" },
      1,
      42,
    )[0];
    concept.raster = canvas.toDataURL("image/png");
    concept.provider = "Test fixture";
    concept.document.symbolSource = "image";
    const workspace = {
      schemaVersion: 1,
      revision: 0,
      brands: [
        {
          id: brandId,
          name: "Cutout QA",
          parentId: null,
          dna: {},
          createdAt: "now",
        },
      ],
      concepts: [concept],
    };
    localStorage.setItem(
      "javlogos.workspace.v1",
      JSON.stringify({ snapshot: workspace, revision: 0 }),
    );
    return concept;
  });
  await page.reload();
  await page.getByRole("tab", { name: "Design", exact: true }).click();
  await page
    .getByRole("button", { name: "Remove flat background", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Remove flat background" });
  await expect(
    dialog.getByRole("img", { name: "Transparent symbol preview" }),
  ).toBeVisible();
  await dialog.getByLabel("Also remove matching enclosed areas").check();
  await expect(
    dialog.getByRole("button", { name: "Save as new concept" }),
  ).toBeEnabled();
  await page.screenshot({ path: "artifacts/delivery-cutout-preview.png" });
  await dialog.getByRole("button", { name: "Save as new concept" }).click();
  await expect(dialog).toHaveCount(0);
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("javlogos.workspace.v1")!).snapshot,
  );
  expect(saved.concepts).toHaveLength(2);
  expect(saved.concepts[0]).toEqual(fixture);
  const derived = saved.concepts[1];
  expect(derived.raster).toBe(fixture.raster);
  expect(derived.derivedFrom).toBe(fixture.id);
  expect(derived.document.useCutout).toBe(true);
  const pixels = await page.evaluate(async (png) => {
    const image = new Image();
    image.src = png;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    return [
      context.getImageData(0, 0, 1, 1).data[3],
      context.getImageData(
        Math.floor(image.width / 2),
        Math.floor(image.height / 2),
        1,
        1,
      ).data[3],
      ...context.getImageData(6, 6, 1, 1).data,
    ];
  }, derived.cutout);
  expect(pixels).toEqual([0, 0, 36, 87, 255, 255]);
  await page.reload();
  const after = await page.evaluate(
    () => JSON.parse(localStorage.getItem("javlogos.workspace.v1")!).snapshot,
  );
  expect(after.concepts[1].cutout).toBe(derived.cutout);
});

test("outlined text and monograms retain visible size, baseline and strokes", async ({
  page,
}) => {
  await page.goto("/");
  const comparisons = await page.evaluate(async () => {
    const exportPath = "/src/infrastructure/export.ts",
      fontPath = "/src/infrastructure/font-export.ts",
      outlinePath = "/src/infrastructure/font-outlines.ts";
    const { rasterize } = await import(exportPath);
    const { prepareCompositionSvg } = await import(fontPath);
    const { outlineComposition } = await import(outlinePath);
    async function ink(svg: string) {
      const bytes: Uint8Array = await rasterize(svg);
      const bitmap = await createImageBitmap(
        new Blob([bytes], { type: "image/png" }),
      );
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let minX = canvas.width,
        minY = canvas.height,
        maxX = 0,
        maxY = 0,
        count = 0;
      for (let y = 0; y < canvas.height; y++)
        for (let x = 0; x < canvas.width; x++)
          if (pixels[(y * canvas.width + x) * 4 + 3] > 128) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            count++;
          }
      bitmap.close();
      return { box: [minX, minY, maxX, maxY], count };
    }
    const result = [];
    for (const fontFamily of [
      "Manrope",
      "Google Sans Flex",
      "Playfair Display",
    ]) {
      const doc = {
        shape: "monogram",
        text: "Málaga",
        primary: "#111111",
        background: "#ffffff",
        fontFamily,
        scale: 1,
        rotation: 0,
        letterSpacing: 1.5,
        strokeWidth: 2,
        transparentBackground: true,
      };
      result.push({
        fontFamily,
        live: await ink(await prepareCompositionSvg(doc)),
        outlined: await ink(await outlineComposition(doc)),
      });
    }
    return result;
  });
  for (const comparison of comparisons) {
    for (let i = 0; i < 4; i++)
      expect(
        Math.abs(comparison.live.box[i] - comparison.outlined.box[i]),
        comparison.fontFamily,
      ).toBeLessThan(5);
    expect(
      comparison.outlined.count / comparison.live.count,
      comparison.fontFamily,
    ).toBeGreaterThan(0.9);
    expect(
      comparison.outlined.count / comparison.live.count,
      comparison.fontFamily,
    ).toBeLessThan(1.1);
  }
});
