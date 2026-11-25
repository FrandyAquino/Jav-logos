import type { VectorContour, VectorNode, VectorPath } from "./types";

const coordinateKeys = ["x", "y", "inX", "inY", "outX", "outY"] as const;
export function validateVectorPaths(paths: VectorPath[]): void {
  if (!paths.length || paths.length > 100)
    throw new Error("Use between one and 100 vector paths.");
  let contours = 0,
    nodes = 0;
  const ids = new Set<string>();
  const identity = (id: string) => {
    if (!id || ids.has(id))
      throw new Error("Vector identities must be unique.");
    ids.add(id);
  };
  for (const path of paths) {
    identity(path.id);
    if (
      !/^#[0-9a-f]{6}$/i.test(path.fill) ||
      !["nonzero", "evenodd", undefined].includes(path.fillRule)
    )
      throw new Error("Unsupported path fill.");
    if (!path.contours.length) throw new Error("A path needs a contour.");
    for (const contour of path.contours) {
      contours++;
      if (contour.nodes.length < 2 || typeof contour.closed !== "boolean")
        throw new Error("A contour needs at least two nodes.");
      for (const node of contour.nodes) {
        nodes++;
        identity(node.id);
        for (const key of coordinateKeys) {
          const value = node[key];
          if (
            (key === "x" || key === "y" || value !== undefined) &&
            (!Number.isFinite(value) || Math.abs(value!) > 1000)
          )
            throw new Error(
              "Vector coordinates must be finite and within ±1000.",
            );
        }
        if (
          (node.inX === undefined) !== (node.inY === undefined) ||
          (node.outX === undefined) !== (node.outY === undefined)
        )
          throw new Error("Curve handles require both coordinates.");
      }
    }
  }
  if (contours > 200 || nodes > 3000)
    throw new Error("Vector detail exceeds 200 contours or 3000 nodes.");
}
const number = (value: number) => String(Math.round(value * 10000) / 10000);
function segment(from: VectorNode, to: VectorNode): string {
  return from.outX !== undefined || to.inX !== undefined
    ? `C${number(from.outX ?? from.x)} ${number(from.outY ?? from.y)} ${number(to.inX ?? to.x)} ${number(to.inY ?? to.y)} ${number(to.x)} ${number(to.y)}`
    : `L${number(to.x)} ${number(to.y)}`;
}
export function pathData(path: VectorPath): string {
  validateVectorPaths([path]);
  return path.contours
    .map((contour) => {
      const first = contour.nodes[0];
      const last = contour.nodes.at(-1)!;
      const commands = [
        `M${number(first.x)} ${number(first.y)}`,
        ...contour.nodes
          .slice(1)
          .map((node, index) => segment(contour.nodes[index], node)),
      ];
      if (contour.closed) {
        if (last.outX !== undefined || first.inX !== undefined)
          commands.push(segment(last, first));
        commands.push("Z");
      }
      return commands.join(" ");
    })
    .join(" ");
}
export function createStarterPaths(fill = "#7775E7"): VectorPath[] {
  return [
    {
      id: crypto.randomUUID(),
      fill,
      fillRule: "nonzero",
      contours: [
        {
          closed: true,
          nodes: [
            [0, -75],
            [75, 0],
            [0, 75],
            [-75, 0],
          ].map(([x, y]) => ({ id: crypto.randomUUID(), x, y })),
        },
      ],
    },
  ];
}
function edit(
  paths: VectorPath[],
  pathId: string,
  contourIndex: number,
  nodeId: string,
  change: (node: VectorNode, contour: VectorContour, index: number) => void,
): VectorPath[] {
  const copy = structuredClone(paths);
  const contour = copy.find((path) => path.id === pathId)?.contours[
    contourIndex
  ];
  const index = contour?.nodes.findIndex((node) => node.id === nodeId) ?? -1;
  if (!contour || index < 0)
    throw new Error("Selected vector node no longer exists.");
  change(contour.nodes[index], contour, index);
  validateVectorPaths(copy);
  return copy;
}
export function moveNode(
  paths: VectorPath[],
  pathId: string,
  contourIndex: number,
  nodeId: string,
  x: number,
  y: number,
): VectorPath[] {
  return edit(paths, pathId, contourIndex, nodeId, (node) => {
    const dx = x - node.x,
      dy = y - node.y;
    node.x = x;
    node.y = y;
    if (node.inX !== undefined) {
      node.inX += dx;
      node.inY! += dy;
    }
    if (node.outX !== undefined) {
      node.outX += dx;
      node.outY! += dy;
    }
  });
}
export function moveHandle(
  paths: VectorPath[],
  pathId: string,
  contourIndex: number,
  nodeId: string,
  side: "in" | "out",
  x: number,
  y: number,
): VectorPath[] {
  return edit(paths, pathId, contourIndex, nodeId, (node) => {
    if (side === "in") {
      node.inX = x;
      node.inY = y;
    } else {
      node.outX = x;
      node.outY = y;
    }
  });
}
const midpoint = (
  a: { x: number; y: number },
  b: { x: number; y: number },
) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
export function insertNode(
  paths: VectorPath[],
  pathId: string,
  contourIndex: number,
  afterNodeId: string,
): VectorPath[] {
  return edit(
    paths,
    pathId,
    contourIndex,
    afterNodeId,
    (node, contour, index) => {
      const next =
        contour.nodes[index + 1] ??
        (contour.closed ? contour.nodes[0] : undefined);
      if (!next)
        throw new Error("Choose a segment before the final open node.");
      const created: VectorNode = {
        id: crypto.randomUUID(),
        ...midpoint(node, next),
      };
      if (node.outX !== undefined || next.inX !== undefined) {
        const a = midpoint(node, {
          x: node.outX ?? node.x,
          y: node.outY ?? node.y,
        });
        const b = midpoint(
          { x: node.outX ?? node.x, y: node.outY ?? node.y },
          { x: next.inX ?? next.x, y: next.inY ?? next.y },
        );
        const c = midpoint(
          { x: next.inX ?? next.x, y: next.inY ?? next.y },
          next,
        );
        const d = midpoint(a, b),
          e = midpoint(b, c),
          point = midpoint(d, e);
        Object.assign(node, { outX: a.x, outY: a.y });
        Object.assign(next, { inX: c.x, inY: c.y });
        Object.assign(created, {
          ...point,
          inX: d.x,
          inY: d.y,
          outX: e.x,
          outY: e.y,
        });
      }
      contour.nodes.splice(index + 1, 0, created);
    },
  );
}
export function removeNode(
  paths: VectorPath[],
  pathId: string,
  contourIndex: number,
  nodeId: string,
): VectorPath[] {
  return edit(paths, pathId, contourIndex, nodeId, (_node, contour, index) => {
    if (contour.nodes.length <= 2)
      throw new Error("Keep at least two nodes in a contour.");
    contour.nodes.splice(index, 1);
  });
}
export function recolorPath(
  paths: VectorPath[],
  pathId: string,
  fill: string,
): VectorPath[] {
  const copy = paths.map((path) =>
    path.id === pathId ? { ...path, fill } : path,
  );
  if (!copy.some((path) => path.id === pathId))
    throw new Error("Selected path no longer exists.");
  validateVectorPaths(copy);
  return copy;
}
export function alignPath(
  paths: VectorPath[],
  pathId: string,
  axis: "horizontal" | "vertical",
): VectorPath[] {
  const copy = structuredClone(paths);
  const path = copy.find((path) => path.id === pathId);
  if (!path) throw new Error("Selected path no longer exists.");
  const points = path.contours.flatMap((c) => c.nodes);
  const key = axis === "horizontal" ? "x" : "y";
  const center =
    (Math.min(...points.map((p) => p[key])) +
      Math.max(...points.map((p) => p[key]))) /
    2;
  for (const point of points) {
    point[key] -= center;
    if (axis === "horizontal") {
      if (point.inX !== undefined) point.inX -= center;
      if (point.outX !== undefined) point.outX -= center;
    } else {
      if (point.inY !== undefined) point.inY -= center;
      if (point.outY !== undefined) point.outY -= center;
    }
  }
  validateVectorPaths(copy);
  return copy;
}
