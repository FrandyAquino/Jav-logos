import manifest from "../../shared/font-assets.json";
import { renderSvg } from "../domain/vector";
import type { VectorDocument } from "../domain/types";
type FontAsset = { path: string; weight: string; unicodeRange: string };
const binaryCache = new Map<string, Promise<Uint8Array>>();
export function bundledFont(family: string) {
  return manifest.find((font) => font.family === family);
}
async function bytes(path: string): Promise<Uint8Array> {
  let request = binaryCache.get(path);
  if (!request) {
    request = fetch(path).then(async (response) => {
      if (!response.ok)
        throw new Error("Bundled font asset could not be loaded.");
      return new Uint8Array(await response.arrayBuffer());
    });
    binaryCache.set(path, request);
    request.catch(() => binaryCache.delete(path));
  }
  return request;
}
const xml = (text: string) =>
  text.replace(
    /[<>&]/g,
    (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[char]!,
  );
function base64(data: Uint8Array) {
  let text = "";
  for (let offset = 0; offset < data.length; offset += 8192)
    text += String.fromCharCode(...data.subarray(offset, offset + 8192));
  return btoa(text);
}
export async function fontLicense(family: string): Promise<string | null> {
  const font = bundledFont(family);
  return font ? new TextDecoder().decode(await bytes(font.licensePath)) : null;
}
export async function prepareCompositionSvg(
  document: VectorDocument,
): Promise<string> {
  const svg = renderSvg(document);
  const font = bundledFont(document.fontFamily);
  if (!font) return svg;
  const declarations = await Promise.all(
    font.faces.map(
      async (face: FontAsset) =>
        `@font-face{font-family:${JSON.stringify(font.family)};font-style:normal;font-weight:${face.weight};src:url(data:font/woff2;base64,${base64(await bytes(face.path))}) format('woff2');unicode-range:${face.unicodeRange};}`,
    ),
  );
  const license = await fontLicense(font.family);
  return svg.replace(
    "><rect",
    `><metadata>${xml(`${font.family}\n${license}`)}</metadata><defs><style>${declarations.join("\n")}</style></defs><rect`,
  );
}
