// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useStudio } from "./use-studio";
it("keeps the latest reference and does not resurrect a cleared pending import", async () => {
  const readers: FakeReader[] = [];
  class FakeReader {
    result = "";
    onload?: () => void;
    onerror?: () => void;
    readAsDataURL() {
      readers.push(this);
    }
  }
  class FakeImage {
    width = 32;
    height = 32;
    data = "";
    onload?: () => void;
    onerror?: () => void;
    set src(value: string) {
      this.data = value;
      queueMicrotask(() => this.onload?.());
    }
  }
  let rendered = "";
  vi.stubGlobal("FileReader", FakeReader);
  vi.stubGlobal("Image", FakeImage);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: (image: FakeImage) => {
      rendered = image.data;
    },
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(
    () => rendered,
  );
  const { result } = renderHook(() => useStudio());
  await waitFor(() => expect(result.current.ready).toBe(true));
  const file = new File(["png"], "reference.png", { type: "image/png" });
  let first: Promise<void>;
  let second: Promise<void>;
  act(() => {
    first = result.current.importReference(file);
    second = result.current.importReference(file);
  });
  await act(async () => {
    readers[1].result = "second";
    readers[1].onload?.();
    await second;
  });
  await act(async () => {
    readers[0].result = "first";
    readers[0].onload?.();
    await first;
  });
  expect(result.current.referenceUrl).toBe("second");
  let pending: Promise<void>;
  act(() => {
    pending = result.current.importReference(file);
    result.current.clearReference();
  });
  await act(async () => {
    readers[2].result = "cleared";
    readers[2].onload?.();
    await pending;
  });
  expect(result.current.referenceUrl).toBeNull();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
