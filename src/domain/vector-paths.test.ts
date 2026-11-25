import { describe, expect, it } from "vitest";
import {
  createStarterPaths,
  insertNode,
  moveNode,
  pathData,
  removeNode,
  validateVectorPaths,
} from "./vector-paths";
describe("editable vector paths", () => {
  it("moves an anchor with its handles without mutating the original", () => {
    const paths = createStarterPaths("#112233");
    const node = paths[0].contours[0].nodes[0];
    node.inX = node.x - 5;
    node.inY = node.y;
    node.outX = node.x + 5;
    node.outY = node.y;
    const moved = moveNode(paths, paths[0].id, 0, node.id, 20, 30);
    expect(moved[0].contours[0].nodes[0]).toMatchObject({
      x: 20,
      y: 30,
      inX: 15,
      inY: 30,
      outX: 25,
      outY: 30,
    });
    expect(node.x).toBe(0);
  });
  it("splits a cubic curve exactly at its midpoint and preserves closing contours", () => {
    const paths = createStarterPaths();
    const c = paths[0].contours[0];
    c.closed = false;
    c.nodes = c.nodes.slice(0, 2);
    Object.assign(c.nodes[0], { x: 0, y: 0, outX: 0, outY: 100 });
    Object.assign(c.nodes[1], { x: 100, y: 0, inX: 100, inY: 100 });
    const split = insertNode(paths, paths[0].id, 0, c.nodes[0].id);
    const nodes = split[0].contours[0].nodes;
    expect(nodes[1]).toMatchObject({
      x: 50,
      y: 75,
      inX: 25,
      inY: 75,
      outX: 75,
      outY: 75,
    });
    expect(nodes[0]).toMatchObject({ outX: 0, outY: 50 });
    expect(nodes[2]).toMatchObject({ inX: 100, inY: 50 });
    expect(pathData(split[0])).toBe(
      "M0 0 C0 50 25 75 50 75 C75 75 100 50 100 0",
    );
  });
  it("rejects invalid geometry and prevents deleting a contour below two points", () => {
    const paths = createStarterPaths();
    paths[0].contours[0].nodes[0].x = Infinity;
    expect(() => validateVectorPaths(paths)).toThrow();
    const line = createStarterPaths();
    line[0].contours[0].nodes = line[0].contours[0].nodes.slice(0, 2);
    expect(() =>
      removeNode(line, line[0].id, 0, line[0].contours[0].nodes[0].id),
    ).toThrow(/two/i);
  });
});
