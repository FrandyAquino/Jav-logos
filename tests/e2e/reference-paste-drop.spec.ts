import { test, expect, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const png = (await readFile("src-tauri/icons/icon.png")).toString("base64");
const validationError = "Choose a PNG, JPEG or WebP reference under 10 MB.";

async function createBrand(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create your first brand", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Brand name").fill("Image input QA");
  await dialog
    .getByRole("button", { name: "Create brand", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
}

async function sendFiles(
  target: Locator,
  kind: "paste" | "drop",
  files: { name: string; type: string; size?: number }[],
) {
  return target.evaluate(
    (element, { kind, files, png }) => {
      const transfer = new DataTransfer();
      for (const file of files) {
        const bytes = file.size
          ? new Uint8Array(file.size)
          : Uint8Array.from(atob(png), (char) => char.charCodeAt(0));
        transfer.items.add(new File([bytes], file.name, { type: file.type }));
      }
      const event =
        kind === "paste"
          ? new ClipboardEvent("paste", {
              clipboardData: transfer,
              bubbles: true,
              cancelable: true,
            })
          : new DragEvent("drop", {
              dataTransfer: transfer,
              bubbles: true,
              cancelable: true,
            });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    },
    { kind, files, png },
  );
}

test("pastes clipboard images from the textarea or another composer control and keeps only the first", async ({
  page,
}) => {
  await createBrand(page);
  const prompt = page.getByRole("textbox", { name: "Describe your logo" });
  await prompt.fill("Keep this prompt");
  await prompt.focus();
  expect(
    await sendFiles(prompt, "paste", [
      { name: "image.png", type: "image/png" },
    ]),
  ).toBe(true);
  await expect(page.locator(".reference-card")).toContainText(
    "Pasted image.png",
  );
  await expect(
    page.getByRole("button", { name: "Preview reference image" }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Generation provider", exact: true }),
  ).toContainText("Local AI");
  await expect(prompt).toHaveValue("Keep this prompt");
  const add = page.getByRole("button", { name: "Add reference image" });
  await expect(add).toBeEnabled();
  await add.focus();
  expect(
    await sendFiles(add, "paste", [
      { name: "first.png", type: "image/png" },
      { name: "second.png", type: "image/png" },
    ]),
  ).toBe(true);
  await expect(page.locator(".reference-card")).toContainText("first.png");
  await expect(
    page.getByRole("status").filter({ hasText: "Only one reference is used" }),
  ).toBeVisible();
  await expect(page.locator(".reference-card")).not.toContainText("second.png");
});

test("shows a drop target, imports an image and surfaces the existing type/size errors", async ({
  page,
}) => {
  await createBrand(page);
  const composer = page.locator(".prompt-composer");
  await composer.evaluate((element) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["png"], "drop.png", { type: "image/png" }));
    element.dispatchEvent(
      new DragEvent("dragenter", {
        dataTransfer: transfer,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Drop image to use as reference" }),
  ).toBeVisible();
  expect(
    await sendFiles(composer, "drop", [
      { name: "drop.png", type: "image/png" },
    ]),
  ).toBe(true);
  await expect(page.locator(".reference-card")).toContainText("drop.png");
  await expect(
    page.getByRole("button", { name: "Preview reference image" }),
  ).toBeVisible();
  await expect(composer).not.toHaveClass(/reference-drop-active/);
  for (const file of [
    { name: "unsupported.gif", type: "image/gif" },
    { name: "untrusted.svg", type: "image/svg+xml" },
    { name: "document.pdf", type: "application/pdf" },
    { name: "large.png", type: "image/png", size: 10_000_001 },
  ]) {
    await expect(
      page.getByRole("button", { name: "Add reference image" }),
    ).toBeEnabled();
    await sendFiles(composer, "drop", [file]);
    await expect(page.getByRole("alert")).toContainText(validationError);
    await expect(page.locator(".reference-card")).toContainText("drop.png");
    await page.getByRole("button", { name: "Dismiss error" }).click();
  }
  await sendFiles(composer, "paste", [
    { name: "untrusted.svg", type: "image/svg+xml" },
  ]);
  await expect(page.getByRole("alert")).toContainText(validationError);
  await expect(page.locator(".reference-card")).toContainText("drop.png");
});

test("leaves text and internal brand drags alone", async ({ page }) => {
  await createBrand(page);
  const composer = page.locator(".prompt-composer");
  for (const type of ["text/plain", "application/x-javlogos-brand"]) {
    const prevented = await composer.evaluate((element, type) => {
      const transfer = new DataTransfer();
      transfer.setData(type, "brand-or-text");
      return ["dragenter", "dragover", "drop"].map((kind) => {
        const event = new DragEvent(kind, {
          dataTransfer: transfer,
          bubbles: true,
          cancelable: true,
        });
        element.dispatchEvent(event);
        return event.defaultPrevented;
      });
    }, type);
    expect(prevented).toEqual([false, false, false]);
    await expect(composer).not.toHaveClass(/reference-drop-active/);
  }
  const prompt = page.getByRole("textbox", { name: "Describe your logo" });
  const prevented = await prompt.evaluate((element) => {
    const transfer = new DataTransfer();
    transfer.setData("text/plain", "Plain text");
    const event = new ClipboardEvent("paste", {
      clipboardData: transfer,
      bubbles: true,
      cancelable: true,
    });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(false);
  await expect(page.locator(".reference-card")).toHaveCount(0);
});
