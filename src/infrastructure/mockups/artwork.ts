import type { Concept } from "../../domain/types";
import type { MockupSource } from "../../domain/mockups";
import { prepareCompositionSvg } from "../font-export";
import { compositionAsset } from "../composition";
import { rasterize } from "../export";
import { loadRaster } from "../raster-tools";

function pngUrl(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return `data:image/png;base64,${btoa(binary)}`;
}
export async function prepareMockupArtwork(
  concept: Concept,
  source: MockupSource,
  includeBackground: boolean,
): Promise<HTMLCanvasElement> {
  let png: string;
  if (source === "original" || source === "cutout") {
    const asset = source === "cutout" ? concept.cutout : concept.raster;
    if (!asset)
      throw new Error(
        `This concept has no ${source === "cutout" ? "transparent cutout" : "original image"}.`,
      );
    png = asset;
  } else {
    const document = {
      ...concept.document,
      transparentBackground: !includeBackground,
      ...(source === "symbol"
        ? {
            layout: "symbol" as const,
            showSymbol: true,
            showWordmark: false,
            showSlogan: false,
          }
        : {}),
    };
    png = pngUrl(
      await rasterize(
        await prepareCompositionSvg(
          document,
          compositionAsset({ ...concept, document }),
        ),
        2048,
      ),
    );
  }
  const { canvas, context } = await loadRaster(png);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let left = canvas.width,
    right = -1,
    top = canvas.height,
    bottom = -1;
  for (let y = 0; y < canvas.height; y++)
    for (let x = 0; x < canvas.width; x++)
      if (pixels[(y * canvas.width + x) * 4 + 3] > 1) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
  if (right < left)
    throw new Error("The selected artwork has no visible pixels.");
  const crop = document.createElement("canvas");
  crop.width = right - left + 1;
  crop.height = bottom - top + 1;
  const cropped = crop.getContext("2d");
  if (!cropped) throw new Error("Artwork processing is unavailable.");
  cropped.drawImage(
    canvas,
    left,
    top,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height,
  );
  return crop;
}
