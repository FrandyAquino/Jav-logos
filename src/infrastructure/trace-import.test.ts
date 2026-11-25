// @vitest-environment jsdom
import { expect, it } from "vitest";
import { importTracePaths } from "./trace-import";
import { pathData } from "../domain/vector-paths";
it("normalizes transforms, curves and holes without splitting their fill semantics", () => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><g transform="translate(10 0)" fill="#123456"><path fill-rule="evenodd" d="M0 0L100 0L100 100L0 100Z M20 20Q50 0 80 20L80 80L20 80Z"/></g></svg>';
  const paths = importTracePaths(svg);
  expect(paths).toHaveLength(1);
  expect(paths[0].fillRule).toBe("evenodd");
  expect(paths[0].contours).toHaveLength(2);
  expect(paths[0].fill).toBe("#123456");
  expect(paths[0].contours[0].nodes[0]).toMatchObject({ x: -81, y: -45 });
  expect(pathData(paths[0])).toContain("C");
});
it("rejects XML document declarations and entities before parsing", () => {
  expect(() =>
    importTracePaths(
      '<!DOCTYPE svg [<!ENTITY x "expanded">]><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M0 0L10 0L0 10Z"/></svg>',
    ),
  ).toThrow(/entities/);
});
it("handles elliptical arcs and relative paths", () => {
  const paths = importTracePaths(
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><path fill="black" d="m10 50a40 40 0 1 0 80 0a40 40 0 1 0-80 0z"/></svg>',
  );
  expect(pathData(paths[0])).toContain("C");
  expect(paths[0].contours[0].closed).toBe(true);
});
it("refuses unsupported artwork rather than silently losing it", () => {
  for (const body of [
    "<text>Hello</text>",
    '<image href="https://example.com/x"/>',
    '<path fill="url(#paint)" d="M0 0L10 0L0 10Z"/>',
    '<g opacity="0.5"><path d="M0 0L10 0L0 10Z"/></g>',
    '<path transform="bad(12)" d="M0 0L10 0L0 10Z"/>',
  ])
    expect(() =>
      importTracePaths(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${body}</svg>`,
      ),
    ).toThrow();
});
