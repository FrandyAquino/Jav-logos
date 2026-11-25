import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { chooseOption } from "./controls";
test("composition, comparison, DNA preview, nodes, motion and brand book persist", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Create your first brand" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Brand name")
    .fill("Studio Expansion QA");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create brand", exact: true })
    .click();
  await chooseOption(page, "Brand typography", "Manrope");
  await page
    .getByLabel("Describe your logo")
    .fill("A precise architectural mark");
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Select .* study/ }),
  ).toHaveCount(4);
  await expect(page.getByLabel("Describe your logo")).toHaveValue("");
  await page.getByText("Last sent prompt", { exact: true }).click();
  await page.getByRole("button", { name: "Use prompt again" }).click();
  await expect(page.getByLabel("Describe your logo")).toHaveValue(
    "A precise architectural mark",
  );
  await page.getByRole("tab", { name: "Design", exact: true }).click();
  await chooseOption(page, "Logo arrangement", "Horizontal");
  await page
    .getByLabel("Logo slogan", { exact: true })
    .fill("Made with intention");
  await page.getByLabel("Logo slogan", { exact: true }).press("Tab");
  const snapshot = () =>
    page.evaluate(
      () => JSON.parse(localStorage.getItem("javlogos.workspace.v1")!).snapshot,
    );
  await expect
    .poll(async () => (await snapshot()).concepts[0].document.slogan)
    .toBe("Made with intention");
  const tools = page.getByRole("group", { name: "Studio tools" });
  await tools.getByRole("button", { name: "Compare", exact: true }).click();
  await page.getByRole("button", { name: "Favorite comparison 1" }).click();
  await page.getByLabel("Notes for comparison 1").fill("Strongest direction");
  await page.getByLabel("Notes for comparison 1").press("Tab");
  await expect
    .poll(async () => (await snapshot()).concepts[0].notes)
    .toBe("Strongest direction");
  expect((await snapshot()).concepts[0].favorite).toBe(true);
  await page.screenshot({ path: "artifacts/expansion-compare-dark.png" });
  await tools.getByRole("button", { name: "Mockups", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Brand applications" }),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/expansion-mockup-dark.png" });
  await tools.getByRole("button", { name: "DNA map", exact: true }).click();
  const before = await snapshot();
  await chooseOption(page, "Preview typography", "Space Grotesk");
  expect((await snapshot()).brands).toEqual(before.brands);
  await page
    .getByRole("button", { name: "Apply DNA to Studio Expansion QA" })
    .click();
  await expect
    .poll(async () => (await snapshot()).brands[0].dna.typography)
    .toBe("Space Grotesk");
  expect((await snapshot()).concepts).toEqual(before.concepts);
  await tools
    .getByRole("button", { name: "Vector editor", exact: true })
    .click();
  await page.getByRole("button", { name: "Start editable symbol" }).click();
  await expect(page.getByLabel("Node X", { exact: true })).toBeVisible();
  const previousX = Number(
    await page.getByLabel("Node X", { exact: true }).inputValue(),
  );
  await page.getByLabel("Node X", { exact: true }).fill(String(previousX + 12));
  await page.getByLabel("Node X", { exact: true }).press("Tab");
  await expect
    .poll(
      async () =>
        (await snapshot()).concepts[0].document.paths[0].contours[0].nodes[0].x,
    )
    .toBe(previousX + 12);
  await page.getByRole("button", { name: "Undo vector edit" }).click();
  await expect(page.getByLabel("Node X", { exact: true })).toHaveValue(
    String(previousX),
  );
  await page.getByRole("button", { name: "Redo vector edit" }).click();
  await expect(page.getByLabel("Node X", { exact: true })).toHaveValue(
    String(previousX + 12),
  );
  await page.screenshot({ path: "artifacts/expansion-vector-dark.png" });
  await tools.getByRole("button", { name: "Motion", exact: true }).click();
  await chooseOption(page, "Motion preset", "Draw paths");
  await page
    .getByRole("button", { name: "Play animation", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Pause animation", exact: true })
    .click();
  await expect(page.locator(".motion-preview")).toHaveAttribute(
    "data-playback",
    "paused",
  );
  await page
    .getByRole("button", { name: "Resume animation", exact: true })
    .click();
  await page.getByRole("button", { name: "Replay", exact: true }).click();
  await expect(page.locator(".motion-preview")).toHaveAttribute(
    "data-playback",
    "running",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(
    page.getByText("Reduced motion enabled", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Replay", exact: true }),
  ).toBeDisabled();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const motionDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export animated SVG" }).click();
  await (await motionDownload).saveAs("artifacts/expansion-motion.svg");
  expect(await readFile("artifacts/expansion-motion.svg", "utf8")).toContain(
    "@keyframes",
  );
  await tools.getByRole("button", { name: "Brand book", exact: true }).click();
  await page
    .getByLabel("Book overview")
    .fill('A brand with <script>alert("x")</script> in its story');
  await page.getByLabel("Book overview").press("Tab");
  const bookDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export brand book", exact: true })
    .click();
  await (await bookDownload).saveAs("artifacts/expansion-book.html");
  const html = await readFile("artifacts/expansion-book.html", "utf8");
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
  expect(
    decodeURIComponent(html.match(/src="(data:image\/svg\+xml[^"]+)"/)![1]),
  ).toContain("data:font/woff2;base64,");
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({ path: "artifacts/expansion-book-light.png" });
  await page.setViewportSize({ width: 960, height: 720 });
  for (const view of [
    "Compare",
    "Mockups",
    "DNA map",
    "Vector editor",
    "Brand book",
    "Motion",
  ]) {
    await tools.getByRole("button", { name: view, exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  const bookPage = await page.context().newPage();
  await bookPage.setContent(html);
  await expect
    .poll(() =>
      bookPage
        .locator("img")
        .evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete &&
              (image as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  await bookPage.screenshot({ path: "artifacts/expansion-book-export.png" });
  await bookPage.close();
  await page.reload();
  expect((await snapshot()).concepts[0].document.symbolSource).toBe("custom");
  expect((await snapshot()).brands[0].book.overview).toContain("<script>");
  expect(errors).toEqual([]);
});

test("raster and sanitized trace symbols remain visible inside exported composition PNGs", async ({
  page,
}) => {
  await page.goto("/");
  const pixels = await page.evaluate(async () => {
    const exportPath = "/src/infrastructure/export.ts";
    const fontPath = "/src/infrastructure/font-export.ts";
    const { rasterize } = await import(exportPath);
    const { prepareCompositionSvg } = await import(fontPath);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 20;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#ff0000";
    context.fillRect(0, 0, 20, 20);
    const raster = canvas.toDataURL("image/png");
    const trace = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path fill="#ff0000" d="M0 0H20V20H0Z"/></svg>')}`;
    const counts: number[] = [];
    for (const [source, asset] of [
      ["image", raster],
      ["trace", trace],
    ]) {
      const svg = await prepareCompositionSvg(
        {
          shape: "orbit",
          text: "QA",
          primary: "#000000",
          background: "#ffffff",
          fontFamily: "Manrope",
          scale: 1,
          rotation: 0,
          letterSpacing: 0,
          strokeWidth: 0,
          symbolSource: source,
          layout: "symbol",
        },
        asset,
      );
      const bytes: Uint8Array = await rasterize(svg);
      const bitmap = await createImageBitmap(
        new Blob([bytes], { type: "image/png" }),
      );
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      context.drawImage(bitmap, 0, 0);
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let red = 0;
      for (let i = 0; i < data.length; i += 4)
        if (data[i] > 240 && data[i + 1] < 20 && data[i + 2] < 20) red++;
      counts.push(red);
      bitmap.close();
    }
    return counts;
  });
  expect(pixels[0]).toBeGreaterThan(1000);
  expect(pixels[1]).toBeGreaterThan(1000);
});
