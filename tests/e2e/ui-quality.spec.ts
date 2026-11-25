import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function createBrand(page: Page, name = "JavLogos") {
  await page.getByRole("button", { name: "Create your first brand" }).click();
  await page.getByRole("dialog").getByLabel("Brand name").fill(name);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create brand", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function accessible(page: Page) {
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
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);
}

test("both themes load bundled Gemini typography and pass empty/dialog accessibility", async ({
  page,
}) => {
  const fonts: string[] = [];
  const external: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "font") fonts.push(request.url());
    if (/fonts\.(googleapis|gstatic)\.com/.test(request.url()))
      external.push(request.url());
  });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const fontState = await page.evaluate(() => ({
    family: getComputedStyle(document.querySelector(".studio")!).fontFamily,
    loaded: Array.from(document.fonts).some(
      (face) =>
        face.family.includes("Google Sans Flex") && face.status === "loaded",
    ),
  }));
  expect(fontState.family).toContain("Google Sans Flex");
  expect(fontState.loaded).toBe(true);
  expect(fonts.some((url) => url.includes("/fonts/google-sans-flex/"))).toBe(
    true,
  );
  expect(external).toEqual([]);
  await accessible(page);
  await page.screenshot({ path: "artifacts/ui-v2-empty-dark.png" });
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await accessible(page);
  await page.screenshot({ path: "artifacts/ui-v2-empty-light.png" });
  await page.getByRole("button", { name: "Create your first brand" }).click();
  await accessible(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("command palette supports keyboard selection and visible focus", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: /Search commands/ }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  const search = page
    .getByRole("dialog", { name: "Command palette" })
    .getByRole("combobox");
  await search.fill("Create a brand");
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Create a brand" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog").getByLabel("Brand name")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: /Search commands/ }),
  ).toBeFocused();
});

test("populated workspace stays readable across desktop and compact layouts", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await createBrand(page, "JavCollections Creative Studio");
  await page.getByLabel("Describe your logo").focus();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Add reference image" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Select .* study/ }),
  ).toHaveCount(4);
  await page.getByRole("tab", { name: "Design", exact: true }).click();
  for (const theme of ["dark", "light"]) {
    if (theme === "light")
      await page.getByRole("button", { name: "Switch to light theme" }).click();
    await accessible(page);
    for (const [width, height] of [
      [1440, 900],
      [1280, 800],
      [960, 720],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const control = page.getByRole("button", {
        name: "Generate",
        exact: true,
      });
      await control.scrollIntoViewIfNeeded();
      await expect(control).toBeVisible();
      const sizes = await page
        .locator(
          ".prompt-composer textarea, .composer-options select, .generate-button",
        )
        .evaluateAll((elements) =>
          elements.map((element) =>
            parseFloat(getComputedStyle(element).fontSize),
          ),
        );
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(11);
      await page.screenshot({ path: `artifacts/ui-v2-${theme}-${width}.png` });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  await page.getByRole("button", { name: "Gallery view" }).click();
  await accessible(page);
  await page.screenshot({ path: "artifacts/ui-v2-gallery.png" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".icon-button")
      .first()
      .evaluate((element) => getComputedStyle(element).transitionDuration),
  ).toBe("0s");
  expect(errors).toEqual([]);
});
