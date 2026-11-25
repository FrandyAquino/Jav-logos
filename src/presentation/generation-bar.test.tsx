// @vitest-environment jsdom
import {
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DEFAULT_DNA } from "../domain/brand-dna";
import { GenerationBar } from "./generation-bar";
import type { StudioState } from "./ui";

afterEach(cleanup);

function setup(overrides: Partial<StudioState> = {}) {
  const studio = {
    selectedBrand: { id: "brand", name: "Studio", dna: DEFAULT_DNA },
    busy: false,
    referenceLoading: false,
    referenceUrl: null,
    referenceInfo: null,
    providerHealth: { available: true, provider: "local", message: "Ready" },
    prompt: "A geometric mark",
    generationTarget: "symbol",
    importReference: vi.fn(async () => {}),
    setPrompt: vi.fn(),
    ...overrides,
  } as StudioState;
  const view = render(<GenerationBar studio={studio} />);
  const textarea = screen.getByRole("textbox", { name: "Describe your logo" });
  const form = textarea.closest("form")!;
  return { studio, textarea, form, ...view };
}

function transfer(
  files: File[] = [],
  types = files.length ? ["Files"] : ["text/plain"],
) {
  return {
    files,
    types,
    items: files.map((file) => ({
      kind: "file",
      type: file.type,
      getAsFile: () => file,
    })),
  };
}

it.each(["image.png", ""])(
  "pastes a clipboard image named %j and cancels default insertion",
  (name) => {
    const { studio, textarea } = setup();
    const file = new File(["png"], name, { type: "image/png" });
    const event = createEvent.paste(textarea, {
      clipboardData: transfer([file]),
    });
    fireEvent(textarea, event);
    expect(event.defaultPrevented).toBe(true);
    expect(studio.importReference).toHaveBeenCalledOnce();
    const imported = vi.mocked(studio.importReference).mock.calls[0][0];
    expect(imported.name).toBe("Pasted image.png");
    expect(imported.type).toBe("image/png");
    expect(imported.size).toBe(file.size);
  },
);

it("handles paste bubbling from another composer control and announces the first of multiple images", () => {
  const { studio } = setup();
  const files = ["reference.png", "other.png"].map(
    (name) => new File(["png"], name, { type: "image/png" }),
  );
  fireEvent.paste(screen.getByRole("button", { name: "Add reference image" }), {
    clipboardData: transfer(files),
  });
  expect(studio.importReference).toHaveBeenCalledExactlyOnceWith(files[0]);
  expect(screen.getByRole("status").textContent).toContain(
    "Only one reference is used",
  );
});

it("leaves plain text paste untouched", () => {
  const { studio, textarea } = setup();
  const event = createEvent.paste(textarea, { clipboardData: transfer() });
  fireEvent(textarea, event);
  expect(event.defaultPrevented).toBe(false);
  expect(studio.importReference).not.toHaveBeenCalled();
});

it("imports an image drop, retains the target over child elements and clears it on exit/drop", () => {
  const { studio, form, textarea } = setup();
  const file = new File(["png"], "drop.png", { type: "image/png" });
  const dataTransfer = transfer([file]);
  fireEvent.dragEnter(form, { dataTransfer });
  fireEvent.dragEnter(textarea, { dataTransfer });
  fireEvent.dragLeave(form, { dataTransfer });
  expect(form.classList.contains("reference-drop-active")).toBe(true);
  expect(screen.getByRole("status").textContent).toBe(
    "Drop image to use as reference",
  );
  const over = createEvent.dragOver(textarea, { dataTransfer });
  fireEvent(textarea, over);
  expect(over.defaultPrevented).toBe(true);
  fireEvent.dragLeave(textarea, { dataTransfer });
  expect(form.classList.contains("reference-drop-active")).toBe(false);
  fireEvent.dragEnter(form, { dataTransfer });
  const drop = createEvent.drop(textarea, { dataTransfer });
  fireEvent(textarea, drop);
  expect(drop.defaultPrevented).toBe(true);
  expect(studio.importReference).toHaveBeenCalledExactlyOnceWith(file);
  expect(form.classList.contains("reference-drop-active")).toBe(false);
});

it.each([
  ["text/plain"],
  ["application/x-javlogos-brand"],
  ["Files", "application/x-javlogos-brand"],
])("ignores non-file/internal drags: %j", (...types) => {
  const { studio, form } = setup();
  const dataTransfer = transfer([], types);
  for (const kind of ["dragEnter", "dragOver", "drop"] as const) {
    const event = createEvent[kind](form, { dataTransfer });
    fireEvent(form, event);
    expect(event.defaultPrevented).toBe(false);
  }
  expect(studio.importReference).not.toHaveBeenCalled();
  expect(form.classList.contains("reference-drop-active")).toBe(false);
});

it.each(["image/gif", "image/svg+xml", "application/pdf"])(
  "forwards unsupported file drops (%s) to the existing validator",
  (type) => {
    const { studio, form } = setup();
    const file = new File(["unsupported"], "unsupported", { type });
    fireEvent.drop(form, { dataTransfer: transfer([file]) });
    expect(studio.importReference).toHaveBeenCalledExactlyOnceWith(file);
  },
);

it.each(["image/gif", "image/svg+xml"])(
  "forwards unsupported clipboard images (%s) to the existing validator",
  (type) => {
    const { studio, textarea } = setup();
    const file = new File(["unsupported"], "unsupported", { type });
    fireEvent.paste(textarea, { clipboardData: transfer([file]) });
    expect(studio.importReference).toHaveBeenCalledExactlyOnceWith(file);
  },
);

it.each([
  { selectedBrand: undefined },
  { busy: true },
  {
    selectedBrand: {
      id: "archived",
      name: "Archived",
      parentId: null,
      createdAt: "2026-11-25T00:00:00.000Z",
      dna: DEFAULT_DNA,
      status: "archived" as const,
    },
  },
  { referenceLoading: true },
])(
  "blocks image paste/drop when the reference button is disabled: %j",
  (overrides) => {
    const { studio, form, textarea } = setup(overrides);
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Add reference image",
      }).disabled,
    ).toBe(true);
    const file = new File(["png"], "reference.png", { type: "image/png" });
    const dataTransfer = transfer([file]);
    for (const kind of ["dragEnter", "dragOver", "drop"] as const) {
      const event = createEvent[kind](form, { dataTransfer });
      fireEvent(form, event);
      expect(event.defaultPrevented).toBe(false);
    }
    const imagePaste = createEvent.paste(textarea, {
      clipboardData: dataTransfer,
    });
    fireEvent(textarea, imagePaste);
    const textPaste = createEvent.paste(textarea, {
      clipboardData: transfer(),
    });
    fireEvent(textarea, textPaste);
    expect(imagePaste.defaultPrevented).toBe(false);
    expect(textPaste.defaultPrevented).toBe(false);
    expect(studio.importReference).not.toHaveBeenCalled();
    expect(form.classList.contains("reference-drop-active")).toBe(false);
  },
);
