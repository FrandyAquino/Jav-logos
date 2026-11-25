import { expect, it } from "vitest";
import { removeFlatBackground } from "./background-removal";
function ring() {
  const data = new Uint8ClampedArray(10 * 10 * 4).fill(255);
  for (let y = 2; y < 8; y++)
    for (let x = 2; x < 8; x++)
      if (x === 2 || x === 7 || y === 2 || y === 7) {
        const i = (y * 10 + x) * 4;
        data[i] = 10;
        data[i + 1] = 50;
        data[i + 2] = 180;
      }
  return data;
}
it("removes the connected background and preserves original colors and enclosed details", () => {
  const original = ring();
  const copy = new Uint8ClampedArray(original);
  const result = removeFlatBackground(original, 10, 10, {
    tolerance: 24,
    includeEnclosed: false,
  });
  expect(original).toEqual(copy);
  expect(result.data[3]).toBe(0);
  expect(
    Array.from(result.data.slice((2 * 10 + 2) * 4, (2 * 10 + 2) * 4 + 4)),
  ).toEqual([10, 50, 180, 255]);
  expect(result.data[(5 * 10 + 5) * 4 + 3]).toBe(255);
  expect(
    removeFlatBackground(original, 10, 10, {
      tolerance: 24,
      includeEnclosed: true,
    }).data[(5 * 10 + 5) * 4 + 3],
  ).toBe(0);
});
it("rejects unsupported backgrounds, blank results and unbounded inputs", () => {
  const mixed = ring();
  for (let x = 0; x < 10; x++) mixed[x * 4] = 0;
  expect(() =>
    removeFlatBackground(mixed, 10, 10, {
      tolerance: 24,
      includeEnclosed: false,
    }),
  ).toThrow(/uniform/);
  expect(() =>
    removeFlatBackground(new Uint8ClampedArray(400).fill(255), 10, 10, {
      tolerance: 24,
      includeEnclosed: true,
    }),
  ).toThrow(/foreground/);
  expect(() =>
    removeFlatBackground(ring(), 10000, 10000, {
      tolerance: 24,
      includeEnclosed: true,
    }),
  ).toThrow(/megapixels/);
  expect(() =>
    removeFlatBackground(ring(), 10, 10, {
      tolerance: NaN,
      includeEnclosed: true,
    }),
  ).toThrow(/settings/);
});
