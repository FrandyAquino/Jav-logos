// Opt-in only. No dependencies, app data, servers, or model files are touched.
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { deflateSync } from "node:zlib";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const directory = mkdtempSync(join(tmpdir(), "javlogos-perf-"));
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(name, data) {
  const type = Buffer.from(name);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([length, type, data, crc]);
}
// Valid 512x512 RGB PNG: gradient, quantized block texture and a central mark.
// Synthetic branding artwork, NOT inference output. Unique tEXt IDs avoid
// falsely deduplicating independent concept files; pixel complexity is fixed.
const pixels = Buffer.alloc(512 * (512 * 3 + 1));
let random = 42;
const noise = Array.from({ length: 64 * 64 }, () => {
  random ^= random << 13;
  random ^= random >>> 17;
  random ^= random << 5;
  return random & 31;
});
for (let y = 0; y < 512; y++) {
  for (let x = 0; x < 512; x++) {
    const offset = y * 1537 + 1 + x * 3;
    const mark = (x - 256) ** 2 + (y - 256) ** 2 < 120 ** 2;
    const n = noise[(y >> 3) * 64 + (x >> 3)];
    pixels[offset] = mark ? 36 + n : 180 + (x >> 4) + n;
    pixels[offset + 1] = mark ? 66 + n : 180 + (y >> 4) + n;
    pixels[offset + 2] = mark ? 100 + n : 200 + n;
  }
}
const header = Buffer.alloc(13);
header.writeUInt32BE(512, 0);
header.writeUInt32BE(512, 4);
header[8] = 8;
header[9] = 2;
const compressed = deflateSync(pixels);
const png = (id) =>
  Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    chunk("IHDR", header),
    chunk("tEXt", Buffer.from(`Fixture\0${id}`)),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
const document = {
  shape: "orbit",
  text: "Baseline",
  primary: "#244264",
  background: "#ffffff",
  fontFamily: "Manrope",
  scale: 1,
  rotation: 0,
  letterSpacing: 0,
  strokeWidth: 2,
  symbolSource: "image",
};
const date = "2026-11-27T12:00:00Z";
try {
  const sources = [
    "src-tauri/src/storage.rs",
    "src-tauri/src/model.rs",
    "src/application/use-studio.ts",
    "src/domain/schema.ts",
    "src/presentation/concept-card.tsx",
    "src/presentation/creative-canvas.tsx",
    "src/presentation/brand-sidebar.tsx",
  ];
  const fingerprint = () =>
    Object.fromEntries(
      sources.map((path) => [
        path,
        createHash("sha256")
          .update(readFileSync(join(root, path)))
          .digest("hex"),
      ]),
    );
  console.log("PERF_SOURCE_START", JSON.stringify(fingerprint()));
  for (const [brands, concepts] of [
    [10, 100],
    [50, 500],
    [200, 2000],
  ]) {
    const snapshot = {
      schemaVersion: 1,
      revision: 0,
      brands: Array.from({ length: brands }, (_, i) => ({
        id: `brand-${i}`,
        name: `Brand ${i}`,
        parentId: null,
        dna: {},
        createdAt: date,
      })),
      concepts: Array.from({ length: concepts }, (_, i) => {
        const raster = `data:image/png;base64,${png(i).toString("base64")}`;
        return {
          id: `concept-${i}`,
          brandId: `brand-${i % brands}`,
          name: `Concept ${i}`,
          prompt: "Synthetic textured geometric brand mark",
          provider: "synthetic-perf-fixture",
          seed: i,
          createdAt: date,
          document,
          raster,
          ...(i % 4 === 0 ? { reference: raster } : {}),
          ...(i % 10 === 0 ? { cutout: raster } : {}),
          tracedSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!-- ${i} -->${Array.from({ length: 25 }, (_, p) => `<path fill="#244264" d="M${p * 4} 10L${p * 4 + 3} 200L250 ${p * 4}Z"/>`).join("")}</svg>`,
          versions: Array.from({ length: 3 }, (_, v) => ({
            id: `v-${v}`,
            createdAt: date,
            document: { ...document, rotation: v },
          })),
        };
      }),
    };
    const json = JSON.stringify(snapshot);
    writeFileSync(join(directory, `workspace-${concepts}.json`), json);
    console.log(
      JSON.stringify({
        fixture: concepts,
        brands,
        pngBytes: png(0).length,
        payloadBytes: Buffer.byteLength(json),
      }),
    );
  }
  const env = { ...process.env, JAVLOGOS_PERF_DIR: directory };
  // Sequential runners avoid CPU/disk contention between our own measurements.
  for (const [program, args] of [
    [
      "cargo",
      [
        "test",
        "--manifest-path",
        "src-tauri/Cargo.toml",
        "--release",
        "workspace_performance_baseline",
        "--",
        "--ignored",
        "--nocapture",
        "--test-threads=1",
      ],
    ],
    [
      "node",
      [
        "node_modules/vitest/vitest.mjs",
        "run",
        "--config",
        "tests/perf/vitest.config.ts",
      ],
    ],
  ]) {
    if (process.argv.includes("--frontend-only") && program === "cargo")
      continue;
    const scope = program === "cargo" ? "native" : "frontend";
    console.log(
      "PERF_STAGE_START",
      JSON.stringify({ scope, sources: fingerprint() }),
    );
    const result = spawnSync(program, args, {
      cwd: root,
      env,
      stdio: "inherit",
    });
    if (result.status !== 0)
      throw new Error(`${program} failed: ${result.status}`);
    console.log(
      "PERF_STAGE_END",
      JSON.stringify({ scope, sources: fingerprint() }),
    );
  }
  for (const count of [100, 500, 2000]) {
    console.log(
      "PERF_TS",
      readFileSync(join(directory, `frontend-${count}.json`), "utf8"),
    );
  }
  console.log("PERF_SOURCE_END", JSON.stringify(fingerprint()));
} finally {
  rmSync(directory, { recursive: true, force: true });
}
