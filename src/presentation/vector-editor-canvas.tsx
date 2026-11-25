import {
  useId,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  type SVGProps,
} from "react";
import { MousePointer2 } from "lucide-react";
import type { VectorNode, VectorPath } from "../domain/types";
import { pathData } from "../domain/vector-paths";
export type PointKind = "anchor" | "in" | "out";
export type Frame = { x: number; y: number; width: number; height: number };
interface VectorEditorCanvasProps {
  svgRef: RefObject<SVGSVGElement | null>;
  frame: Frame;
  paths: VectorPath[];
  path: VectorPath | undefined;
  node: VectorNode | undefined;
  contourPosition: number;
  setSelection: (path: VectorPath, index?: number, node?: VectorNode) => void;
  beginPointer: (
    event: PointerEvent<SVGCircleElement>,
    path: VectorPath,
    index: number,
    node: VectorNode,
    kind: PointKind,
  ) => void;
  keyMove: (
    event: KeyboardEvent<SVGCircleElement>,
    path: VectorPath,
    index: number,
    node: VectorNode,
    kind: PointKind,
  ) => void;
  keyboardEnd: (event: KeyboardEvent<SVGCircleElement>) => void;
  onKeyboardBlur: () => void;
  onKeyDown: SVGProps<SVGSVGElement>["onKeyDown"];
  onPointerMove: SVGProps<SVGSVGElement>["onPointerMove"];
  onPointerUp: SVGProps<SVGSVGElement>["onPointerUp"];
  onPointerCancel: SVGProps<SVGSVGElement>["onPointerCancel"];
  onLostPointerCapture: SVGProps<SVGSVGElement>["onLostPointerCapture"];
}
export function VectorEditorCanvas({
  svgRef,
  frame,
  paths,
  path,
  node,
  contourPosition,
  setSelection,
  beginPointer,
  keyMove,
  keyboardEnd,
  onKeyboardBlur,
  onKeyDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
}: VectorEditorCanvasProps) {
  const gridId = useId();
  const radius = frame.width / 160;
  return (
    <div className="vector-editor-stage">
      <svg
        ref={svgRef}
        viewBox={`${frame.x} ${frame.y} ${frame.width} ${frame.height}`}
        role="group"
        tabIndex={-1}
        aria-label="Editable symbol geometry"
        onKeyDown={onKeyDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onLostPointerCapture}
      >
        <defs>
          <pattern
            id={gridId}
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M20 0H0V20"
              className="editor-grid-line"
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
          </pattern>
        </defs>
        <rect
          x={frame.x}
          y={frame.y}
          width={frame.width}
          height={frame.height}
          fill={`url(#${gridId})`}
        />
        <path
          d={`M${frame.x} 0H${frame.x + frame.width}M0 ${frame.y}V${frame.y + frame.height}`}
          className="editor-axis"
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
        {paths.map((item, index) => (
          <path
            key={item.id}
            d={pathData(item)}
            fill={item.fill}
            fillRule={item.fillRule ?? "nonzero"}
            className={
              item.id === path?.id ? "editor-path selected" : "editor-path"
            }
            vectorEffect="non-scaling-stroke"
            onClick={() => setSelection(item)}
            aria-label={`Path ${index + 1}`}
          />
        ))}
        {path?.contours.map((part, index) =>
          part.nodes.map((point, nodeIndex) => {
            const selected = index === contourPosition && point.id === node?.id;
            return (
              <g key={point.id}>
                {selected &&
                  (["in", "out"] as const).map((side) => {
                    const x = side === "in" ? point.inX : point.outX,
                      y = side === "in" ? point.inY : point.outY;
                    if (x === undefined || y === undefined) return null;
                    return (
                      <g key={side}>
                        <line
                          x1={point.x}
                          y1={point.y}
                          x2={x}
                          y2={y}
                          className="editor-handle-line"
                          vectorEffect="non-scaling-stroke"
                        />
                        <circle
                          cx={x}
                          cy={y}
                          r={radius * 0.8}
                          className="editor-handle"
                          vectorEffect="non-scaling-stroke"
                          role="button"
                          tabIndex={0}
                          aria-label={`${side === "in" ? "Incoming" : "Outgoing"} handle of node ${nodeIndex + 1}`}
                          onPointerDown={(event) =>
                            beginPointer(event, path, index, point, side)
                          }
                          onKeyDown={(event) =>
                            keyMove(event, path, index, point, side)
                          }
                          onKeyUp={keyboardEnd}
                          onBlur={onKeyboardBlur}
                        />
                      </g>
                    );
                  })}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={radius * 2.2}
                  fill="transparent"
                  className="editor-node-hit"
                  aria-hidden="true"
                  onPointerDown={(event) =>
                    beginPointer(event, path, index, point, "anchor")
                  }
                />
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={radius}
                  className={`editor-node ${selected ? "selected" : ""}`}
                  vectorEffect="non-scaling-stroke"
                  role="button"
                  tabIndex={selected ? 0 : -1}
                  aria-label={`Node ${nodeIndex + 1}, contour ${index + 1}`}
                  aria-pressed={selected}
                  onFocus={() => setSelection(path, index, point)}
                  onPointerDown={(event) =>
                    beginPointer(event, path, index, point, "anchor")
                  }
                  onKeyDown={(event) =>
                    keyMove(event, path, index, point, "anchor")
                  }
                  onKeyUp={keyboardEnd}
                  onBlur={onKeyboardBlur}
                />
              </g>
            );
          }),
        )}
      </svg>
      <p className="editor-stage-help">
        <MousePointer2 size={13} /> Drag anchors or handles. Arrow keys move 1
        unit; Shift 10; Alt 0.1. Escape cancels the current gesture.
      </p>
    </div>
  );
}
