import type { BackgroundOptions } from "../domain/background-removal";
export async function loadRaster(png: string) {
  if (
    !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(png) ||
    png.length > 16_000_000
  )
    throw new Error("Invalid local PNG.");
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("PNG could not be decoded."));
    image.src = png;
  });
  if (
    !image.naturalWidth ||
    image.naturalWidth > 4096 ||
    image.naturalHeight > 4096 ||
    !image.naturalHeight ||
    image.naturalWidth * image.naturalHeight > 4_000_000
  )
    throw new Error("Image exceeds the 4 megapixel processing limit.");
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Image processing is unavailable.");
  context.drawImage(image, 0, 0);
  return { canvas, context };
}
export async function createCutout(
  png: string,
  options: BackgroundOptions,
  signal: AbortSignal,
): Promise<{ png: string; removedFraction: number }> {
  const { canvas, context } = await loadRaster(png);
  if (signal.aborted) throw new DOMException("Preview cancelled", "AbortError");
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const worker = new Worker(
    new URL("./background-worker.ts", import.meta.url),
    { type: "module" },
  );
  const result = await new Promise<{
    data: Uint8ClampedArray;
    removedFraction: number;
    bounds: { x: number; y: number; width: number; height: number };
  }>((resolve, reject) => {
    const abort = () => {
      cleanup();
      reject(new DOMException("Preview cancelled", "AbortError"));
    };
    const cleanup = () => {
      worker.terminate();
      signal.removeEventListener("abort", abort);
    };
    signal.addEventListener("abort", abort, { once: true });
    worker.onerror = () => {
      cleanup();
      reject(new Error("Background worker failed."));
    };
    worker.onmessage = (event) => {
      cleanup();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.result);
    };
    worker.postMessage(
      { data, width: canvas.width, height: canvas.height, options },
      [data.buffer],
    );
  });
  if (signal.aborted) throw new DOMException("Preview cancelled", "AbortError");
  context.putImageData(
    new ImageData(
      new Uint8ClampedArray(result.data),
      canvas.width,
      canvas.height,
    ),
    0,
    0,
  );
  const crop = document.createElement("canvas");
  const pad = Math.max(
    2,
    Math.ceil(Math.max(result.bounds.width, result.bounds.height) * 0.02),
  );
  crop.width = result.bounds.width + pad * 2;
  crop.height = result.bounds.height + pad * 2;
  const cropContext = crop.getContext("2d");
  if (!cropContext) throw new Error("Image processing is unavailable.");
  cropContext.drawImage(
    canvas,
    result.bounds.x,
    result.bounds.y,
    result.bounds.width,
    result.bounds.height,
    pad,
    pad,
    result.bounds.width,
    result.bounds.height,
  );
  return {
    png: crop.toDataURL("image/png"),
    removedFraction: result.removedFraction,
  };
}
export async function silhouette(png: string, color: string): Promise<string> {
  const { canvas, context } = await loadRaster(png);
  context.globalCompositeOperation = "source-in";
  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}
