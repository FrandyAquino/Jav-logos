// @vitest-environment jsdom
import { expect, it } from "vitest";
import { sanitizeSvg } from "./svg";
it("removes executable markup, external fetches, CSS URLs and event handlers", () => {
  const clean = sanitizeSvg(
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><foreignObject><iframe></iframe></foreignObject><image href="https://evil.invalid/pixel"/><path fill="url(https://evil.invalid/paint)" d="M0 0L10 10" onclick="alert(1)"/><use href="#x"/></svg>',
  );
  expect(clean).not.toMatch(
    /script|foreignObject|onload|onclick|https:|<image|<use/,
  );
  expect(clean).toContain("M0 0L10 10");
});
it("rejects malformed and oversized documents", () => {
  expect(() => sanitizeSvg("not an SVG")).toThrow();
  expect(() => sanitizeSvg("x".repeat(8_000_001))).toThrow(/limit/);
});
