import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { chooseOption } from "./controls";
test("exact refinements preview without saving, preserve the source and keep before/after after reload and source deletion", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Create your first brand" }).click();
  await page.getByRole("dialog").getByLabel("Brand name").fill("Refinement QA");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create brand", exact: true })
    .click();
  await chooseOption(page, "Brand typography", "Manrope");
  await chooseOption(page, "Number of concepts", "1 concept");
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  const snapshot = () =>
    page.evaluate(
      () => JSON.parse(localStorage.getItem("javlogos.workspace.v1")!).snapshot,
    );
  await expect.poll(async () => (await snapshot()).concepts.length).toBe(1);
  const before = await snapshot();
  await page
    .getByRole("group", { name: "Studio tools" })
    .getByRole("button", { name: "Refine", exact: true })
    .click();
  await chooseOption(page, "Refinement typeface", "Space Grotesk");
  await page
    .getByRole("button", { name: "Refinement primary color", exact: true })
    .click();
  await page.getByLabel("Refinement primary hex value").fill("#d45421");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save refined copy" }),
  ).toBeEnabled();
  expect(await snapshot()).toEqual(before);
  await page.screenshot({ path: "artifacts/refinement-preview-dark.png" });
  await page.getByRole("button", { name: "Reset preview" }).click();
  await expect(
    page.getByRole("button", { name: "Save refined copy" }),
  ).toBeDisabled();
  await chooseOption(page, "Refinement typeface", "Space Grotesk");
  await page.getByRole("button", { name: "Save refined copy" }).click();
  await expect(
    page.getByRole("img", { name: "Before refinement snapshot" }),
  ).toBeVisible();
  const saved = await snapshot();
  expect(saved.concepts).toHaveLength(2);
  expect(saved.concepts[0]).toEqual(before.concepts[0]);
  expect(saved.brands).toEqual(before.brands);
  const refined = saved.concepts[1];
  expect(refined.refinement.kind).toBe("composition");
  expect(refined.document.fontFamily).toBe("Space Grotesk");
  await page
    .getByRole("group", { name: "Refinement method" })
    .getByRole("button", { name: "Local AI", exact: true })
    .click();
  await page.getByRole("button", { name: "Simplify", exact: true }).click();
  await expect(page.getByLabel("Refinement instruction")).toContainText(
    "Simplify this symbol",
  );
  await expect(
    page.getByRole("button", { name: "Generate refined symbol" }),
  ).toBeDisabled();
  expect(await snapshot()).toEqual(saved);
  await page.getByRole("button", { name: "Canvas view", exact: true }).click();
  await page
    .getByRole("button", {
      name: `Delete ${before.concepts[0].name}`,
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete concept", exact: true })
    .click();
  await page.reload();
  await page
    .getByRole("group", { name: "Studio tools" })
    .getByRole("button", { name: "Refine", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "Before refinement snapshot" }),
  ).toHaveAttribute("src", refined.refinement.before);
  await expect(
    page.getByText(
      "Source concept is unavailable. Its before snapshot is preserved.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.evaluate(async () => {
    await document.fonts.ready;
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
  await page.screenshot({ path: "artifacts/refinement-history-light.png" });
  await page.setViewportSize({ width: 960, height: 720 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("AI reference uses only the centered symbol at512px, with real nontransparent pixels", async ({
  page,
}) => {
  await page.goto("/");
  const reference = await page.evaluate(async () => {
    const vectorPath = "/src/domain/vector.ts",
      dnaPath = "/src/domain/brand-dna.ts",
      refPath = "/src/infrastructure/refinement-preview.ts";
    const { generateConcepts } = await import(vectorPath),
      { DEFAULT_DNA } = await import(dnaPath),
      { prepareSymbolReference } = await import(refPath);
    const concept = generateConcepts(
      "brand",
      "DO NOT INCLUDE THIS WORDMARK",
      "mark",
      DEFAULT_DNA,
      1,
      42,
    )[0];
    concept.document.slogan = "No slogan in the reference";
    const first = await prepareSymbolReference(concept);
    const second = await prepareSymbolReference({
      ...concept,
      document: {
        ...concept.document,
        text: "DIFFERENT NAME",
        slogan: "Other slogan",
        rotation: 45,
      },
    });
    const image = new Image();
    image.src = first;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, 512, 512).data;
    let colored = 0;
    for (let i = 0; i < data.length; i += 4)
      if (data[i] < 240 && data[i + 1] < 240) colored++;
    return {
      same: first === second,
      width: image.width,
      height: image.height,
      corner: Array.from(data.slice(0, 4)),
      colored,
    };
  });
  expect(reference.same).toBe(true);
  expect([reference.width, reference.height]).toEqual([512, 512]);
  expect(reference.corner).toEqual([255, 255, 255, 255]);
  expect(reference.colored).toBeGreaterThan(10000);
});

test("white symbols receive a contrasting reference background", async ({
  page,
}) => {
  await page.goto("/");
  const corner = await page.evaluate(async () => {
    const vectorPath = "/src/domain/vector.ts",
      dnaPath = "/src/domain/brand-dna.ts",
      refPath = "/src/infrastructure/refinement-preview.ts";
    const { generateConcepts } = await import(vectorPath),
      { DEFAULT_DNA } = await import(dnaPath),
      { prepareSymbolReference } = await import(refPath);
    const concept = generateConcepts(
      "brand",
      "White mark",
      "mark",
      DEFAULT_DNA,
      1,
      42,
    )[0];
    concept.document.primary = "#ffffff";
    const png = await prepareSymbolReference(concept);
    const image = new Image();
    image.src = png;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    return Array.from(ctx.getImageData(0, 0, 1, 1).data);
  });
  expect(corner).toEqual([23, 37, 56, 255]);
});
