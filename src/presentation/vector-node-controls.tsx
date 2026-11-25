import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  Check,
  Minus,
  Plus,
} from "lucide-react";
import type { VectorContour, VectorNode, VectorPath } from "../domain/types";
import {
  alignPath,
  createStarterPaths,
  insertNode,
  moveHandle,
  moveNode,
  recolorPath,
  removeNode,
} from "../domain/vector-paths";
import { ColorField } from "./property-fields";
import { NumberControl } from "./composition-controls";
import { SelectField } from "./select-field";

interface VectorNodeControlsProps {
  paths: VectorPath[];
  path: VectorPath | undefined;
  contour: VectorContour | undefined;
  node: VectorNode | undefined;
  contourPosition: number;
  disabled: boolean;
  primary: string | undefined;
  setSelection: (path: VectorPath, index?: number, node?: VectorNode) => void;
  setContourIndex: (index: number) => void;
  setNodeId: (id: string | null) => void;
  edit: (change: () => VectorPath[]) => void;
}
const clamp = (number: number) =>
  Math.round(Math.min(1000, Math.max(-1000, number)) * 1000) / 1000;
function replaceHandleMode(
  paths: VectorPath[],
  pathId: string,
  contourIndex: number,
  nodeId: string,
  enabled: boolean,
): VectorPath[] {
  if (enabled) {
    const node = paths
      .find((p) => p.id === pathId)!
      .contours[contourIndex].nodes.find((n) => n.id === nodeId)!;
    return moveHandle(
      moveHandle(
        paths,
        pathId,
        contourIndex,
        nodeId,
        "in",
        clamp(node.x - 20),
        node.y,
      ),
      pathId,
      contourIndex,
      nodeId,
      "out",
      clamp(node.x + 20),
      node.y,
    );
  }
  return paths.map((path) =>
    path.id === pathId
      ? {
          ...path,
          contours: path.contours.map((contour, index) =>
            index === contourIndex
              ? {
                  ...contour,
                  nodes: contour.nodes.map((node) =>
                    node.id === nodeId
                      ? { id: node.id, x: node.x, y: node.y }
                      : node,
                  ),
                }
              : contour,
          ),
        }
      : path,
  );
}

export function VectorNodeControls({
  paths,
  path,
  contour,
  node,
  contourPosition,
  disabled,
  primary,
  setSelection,
  setContourIndex,
  setNodeId,
  edit,
}: VectorNodeControlsProps) {
  return (
    <aside
      className="vector-node-inspector"
      aria-label="Path and node properties"
    >
      <SelectField
        label="Vector path"
        value={path?.id ?? ""}
        disabled={disabled}
        onValueChange={(id) => {
          const found = paths.find((item) => item.id === id);
          if (found) setSelection(found);
        }}
        options={paths.map((item, index) => ({
          value: item.id,
          label: `Path ${index + 1}`,
          description: `${item.contours.length} contours`,
        }))}
      />
      {path && (
        <>
          <ColorField
            label="Path fill"
            value={path.fill}
            onChange={(fill) => edit(() => recolorPath(paths, path.id, fill))}
          />
          <div className="editor-align-actions">
            <button
              type="button"
              className="outline-button"
              disabled={disabled}
              onClick={() =>
                edit(() => alignPath(paths, path.id, "horizontal"))
              }
              title="Center anchors horizontally"
            >
              <AlignCenterHorizontal size={14} />
              Center X
            </button>
            <button
              type="button"
              className="outline-button"
              disabled={disabled}
              onClick={() => edit(() => alignPath(paths, path.id, "vertical"))}
              title="Center anchors vertically"
            >
              <AlignCenterVertical size={14} />
              Center Y
            </button>
          </div>
          <SelectField
            label="Vector contour"
            value={String(contourPosition)}
            disabled={disabled}
            onValueChange={(value) => {
              const index = Number(value);
              setContourIndex(index);
              setNodeId(path.contours[index]?.nodes[0]?.id ?? null);
            }}
            options={path.contours.map((part, index) => ({
              value: String(index),
              label: `Contour ${index + 1}`,
              description: part.closed ? "Closed shape" : "Open path",
            }))}
          />
        </>
      )}
      {contour && node && path && (
        <>
          <SelectField
            label="Vector node"
            value={node.id}
            disabled={disabled}
            onValueChange={setNodeId}
            options={contour.nodes.map((item, index) => ({
              value: item.id,
              label: `Node ${index + 1}`,
            }))}
          />
          <div className="editor-number-grid">
            <NumberControl
              key={`${node.id}-x`}
              label="Node X"
              value={node.x}
              min={-1000}
              max={1000}
              step={0.1}
              disabled={disabled}
              onCommit={(x) =>
                edit(() =>
                  moveNode(paths, path.id, contourPosition, node.id, x, node.y),
                )
              }
            />
            <NumberControl
              key={`${node.id}-y`}
              label="Node Y"
              value={node.y}
              min={-1000}
              max={1000}
              step={0.1}
              disabled={disabled}
              onCommit={(y) =>
                edit(() =>
                  moveNode(paths, path.id, contourPosition, node.id, node.x, y),
                )
              }
            />
          </div>
          <label className="editor-checkbox">
            <input
              type="checkbox"
              checked={node.inX !== undefined || node.outX !== undefined}
              disabled={disabled}
              onChange={(event) =>
                edit(() =>
                  replaceHandleMode(
                    paths,
                    path.id,
                    contourPosition,
                    node.id,
                    event.target.checked,
                  ),
                )
              }
            />
            <span>Curve handles</span>
          </label>
          {(["in", "out"] as const).map((side) => {
            const x = side === "in" ? node.inX : node.outX,
              y = side === "in" ? node.inY : node.outY;
            if (x === undefined || y === undefined) return null;
            return (
              <div className="editor-number-grid" key={`${node.id}-${side}`}>
                <NumberControl
                  label={`${side === "in" ? "Incoming" : "Outgoing"} handle X`}
                  value={x}
                  min={-1000}
                  max={1000}
                  step={0.1}
                  disabled={disabled}
                  onCommit={(next) =>
                    edit(() =>
                      moveHandle(
                        paths,
                        path.id,
                        contourPosition,
                        node.id,
                        side,
                        next,
                        y,
                      ),
                    )
                  }
                />
                <NumberControl
                  label={`${side === "in" ? "Incoming" : "Outgoing"} handle Y`}
                  value={y}
                  min={-1000}
                  max={1000}
                  step={0.1}
                  disabled={disabled}
                  onCommit={(next) =>
                    edit(() =>
                      moveHandle(
                        paths,
                        path.id,
                        contourPosition,
                        node.id,
                        side,
                        x,
                        next,
                      ),
                    )
                  }
                />
              </div>
            );
          })}
          <div className="editor-node-actions">
            <button
              type="button"
              className="outline-button"
              disabled={
                disabled ||
                (!contour.closed && node.id === contour.nodes.at(-1)?.id)
              }
              onClick={() =>
                edit(() => insertNode(paths, path.id, contourPosition, node.id))
              }
            >
              <Plus size={13} />
              Split segment
            </button>
            <button
              type="button"
              className="outline-button"
              disabled={disabled || contour.nodes.length <= 2}
              onClick={() =>
                edit(() => removeNode(paths, path.id, contourPosition, node.id))
              }
            >
              <Minus size={13} />
              Remove node
            </button>
          </div>
        </>
      )}
      <div className="editor-path-actions">
        <button
          type="button"
          className="outline-button"
          disabled={disabled || paths.length >= 100}
          onClick={() => {
            const added = createStarterPaths(primary);
            setSelection(added[0]);
            edit(() => [...paths, ...added]);
          }}
        >
          <Plus size={13} />
          Add path
        </button>
        <button
          type="button"
          className="subtle-button"
          disabled={disabled || paths.length <= 1 || !path}
          onClick={() =>
            edit(() => paths.filter((item) => item.id !== path?.id))
          }
        >
          Remove path
        </button>
      </div>
      <p className="field-help">
        <Check size={12} /> Changes are saved on gesture completion. Original
        raster/trace assets stay unchanged.
      </p>
    </aside>
  );
}
