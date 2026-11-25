import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { chooseOption } from "./controls";
import AxeBuilder from "@axe-core/playwright";
async function create(page: Page, name: string, first = false) {
  await page
    .getByRole("button", {
      name: first ? "Create your first brand" : "Create brand",
      exact: true,
    })
    .click();
  await page.getByRole("dialog").getByLabel("Brand name").fill(name);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create brand", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function action(page: Page, name: string, item: string) {
  await page
    .getByRole("button", { name: `Actions for ${name}`, exact: true })
    .click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
}
test("brand lifecycle and drag-to-pin persist without losing saved designs", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "One", true);
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Select .* study/ }),
  ).toHaveCount(4);
  await action(page, "One", "Rename");
  await expect(page.getByLabel("New brand name")).toBeFocused();
  await page.getByLabel("New brand name").fill("Studio One");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(
    page.getByRole("button", { name: "Actions for Studio One" }),
  ).toBeFocused();
  await action(page, "Studio One", "Pin to top");
  await expect(
    page.getByRole("region", { name: "Pinned brands" }),
  ).toContainText("Studio One");
  await create(page, "Two");
  await page
    .getByRole("button", { name: "Open Two", exact: true })
    .locator("..")
    .dragTo(
      page
        .getByRole("region", { name: "Pinned brands" })
        .getByText("Pinned", { exact: true }),
    );
  await expect(
    page.getByRole("region", { name: "Pinned brands" }),
  ).toContainText("Two");
  await action(page, "Two", "Move up");
  await expect(
    page
      .getByRole("region", { name: "Pinned brands" })
      .getByRole("button", { name: /Open / })
      .first(),
  ).toHaveAccessibleName("Open Two");
  await action(page, "Studio One", "Mark completed");
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open Studio One", exact: true }),
  ).toHaveCount(1);
  await action(page, "Studio One", "Archive");
  await page.getByRole("button", { name: "Archived", exact: true }).click();
  await page.getByRole("button", { name: "Open Studio One" }).click();
  await expect(
    page.getByRole("button", { name: /Select .* study/ }),
  ).toHaveCount(4);
  await expect(
    page.getByRole("button", { name: "Generate", exact: true }),
  ).toBeDisabled();
  await action(page, "Studio One", "Restore brand");
  await page.getByRole("button", { name: "Active", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Open Studio One" }).click();
  await expect(
    page.getByRole("button", { name: /Select .* study/ }),
  ).toHaveCount(4);
  const snapshot = await page.evaluate(
    () => JSON.parse(localStorage.getItem("javlogos.workspace.v1")!).snapshot,
  );
  expect(
    snapshot.brands.find((b: { name: string }) => b.name === "Studio One")
      .status,
  ).toBe("active");
  expect(
    snapshot.brands.find((b: { name: string }) => b.name === "Two").pinned,
  ).toBe(true);
});
test("custom controls and bundled font export use actual portable typography", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "Typography", true);
  await chooseOption(page, "Brand typography", "Manrope");
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await page.getByRole("tab", { name: "Design", exact: true }).click();
  await expect(
    page.locator('select:not([aria-hidden="true"]):visible'),
  ).toHaveCount(0);
  await chooseOption(page, "Logo typeface", "Playfair Display");
  await page.evaluate(() => document.fonts.load('500 38px "Playfair Display"'));
  const family = await page
    .locator(".main-artwork text")
    .last()
    .evaluate((el) => getComputedStyle(el).fontFamily);
  expect(family).toContain("Playfair Display");
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Composition SVG", exact: true })
    .click();
  const download = await downloading;
  await download.saveAs("artifacts/embedded-font.svg");
  const svg = await readFile("artifacts/embedded-font.svg", "utf8");
  expect(svg).toContain("data:font/woff2;base64,");
  expect(svg).toContain("SIL OPEN FONT LICENSE");
  expect(svg).toContain("Playfair Display");
  const actualFontPixels = await page.evaluate(async (embeddedSvg) => {
    const modulePath = "/src/infrastructure/export.ts";
    const { rasterize } = await import(modulePath);
    const plain = embeddedSvg
      .replace(/<metadata>[\s\S]*?<\/metadata>/, "")
      .replace(/<defs>[\s\S]*?<\/defs>/, "");
    const embedded: Uint8Array = await rasterize(embeddedSvg);
    const fallback: Uint8Array = await rasterize(plain);
    return (
      embedded.length !== fallback.length ||
      embedded.some((value, index) => value !== fallback[index])
    );
  }, svg);
  expect(actualFontPixels).toBe(true);
  const before = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("javlogos.workspace.v1")!).snapshot
        .concepts[0].document.primary,
  );
  await page.getByRole("button", { name: /Logo color/ }).click();
  await page.getByLabel("Logo hex value").fill("#ff0000");
  await page.keyboard.press("Escape");
  const after = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("javlogos.workspace.v1")!).snapshot
        .concepts[0].document.primary,
  );
  expect(after).toBe(before);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
  await page.screenshot({ path: "artifacts/workflow-controls-fonts.png" });
});
test("reference attachments expose preview and removal without native textarea chrome", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "References", true);
  await page
    .getByLabel("Reference image", { exact: true })
    .setInputFiles("src-tauri/icons/icon.png");
  await expect(page.getByText("icon.png", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Preview reference image" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Remove reference" }).click();
  await expect(
    page.getByRole("button", { name: "Preview reference image" }),
  ).toHaveCount(0);
  expect(
    await page
      .getByLabel("Describe your logo")
      .evaluate((el) => getComputedStyle(el).resize),
  ).toBe("none");
});

test("concept deletion is confirmed, retryable, keyboard accessible and persists through reload", async ({
  page,
}) => {
  await page.goto("/");
  await create(page, "Deletion QA", true);
  await expect(page.getByText("Shared Brand DNA", { exact: true })).toHaveCount(
    0,
  );
  await chooseOption(page, "Brand typography", "Google Sans Flex");
  await expect(page.locator(".type-specimen-sample")).toContainText(
    "0123456789",
  );
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  const concepts = page.getByRole("button", { name: /^Select .* study$/ });
  await expect(concepts).toHaveCount(4);
  const original = await page.evaluate(
    () => JSON.parse(localStorage.getItem("javlogos.workspace.v1")!).snapshot,
  );
  const deleting = page.getByRole("button", {
    name: "Delete Orbit study",
    exact: true,
  });
  await deleting.click();
  const dialog = page.getByRole("dialog", { name: "Delete concept?" });
  await expect(
    dialog.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeFocused();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(deleting).toBeFocused();
  await deleting.click();
  await page.keyboard.press("Escape");
  await expect(deleting).toBeFocused();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("javlogos.workspace.v1")!).snapshot,
    ),
  ).toEqual(original);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Object.assign(window, {
      restoreQaStorage: () => {
        Storage.prototype.setItem = original;
      },
    });
    Storage.prototype.setItem = function (key, value) {
      if (
        key === "javlogos.workspace.v1" &&
        JSON.parse(value).snapshot.concepts.length < 4
      )
        throw new Error("Disk full");
      return original.call(this, key, value);
    };
  });
  await deleting.click();
  await dialog
    .getByRole("button", { name: "Delete concept", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("still saved");
  await expect(page.locator("[data-concept-select]")).toHaveCount(4);
  await page.evaluate(() =>
    (window as unknown as { restoreQaStorage: () => void }).restoreQaStorage(),
  );
  await dialog
    .getByRole("button", { name: "Delete concept", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(concepts).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "Select Petal study", exact: true }),
  ).toBeFocused();
  await page.reload();
  await expect(concepts).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "Select Orbit study", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Gallery view" }).click();
  await page
    .getByRole("button", { name: "Delete Prism study", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Delete concept", exact: true })
    .click();
  await expect(concepts).toHaveCount(2);
  await page.screenshot({ path: "artifacts/concept-deletion-gallery.png" });
  for (const name of ["Petal study", "Monogram study"]) {
    await page
      .getByRole("button", { name: `Delete ${name}`, exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "Delete concept", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
  }
  await expect(
    page.getByRole("heading", { name: "Explore your first concepts" }),
  ).toBeVisible();
  await expect(
    page.getByRole("main", { name: "Creative workspace" }),
  ).toBeFocused();
  await page.reload();
  await expect(concepts).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Open Deletion QA", exact: true }),
  ).toBeVisible();
});
