import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { Maximize, Minus, PenTool, Plus, Redo2, Undo2 } from "lucide-react";
import type { VectorNode, VectorPath } from "../domain/types";
import { moveHandle, moveNode } from "../domain/vector-paths";
import type { StudioState } from "./ui";
import "./editor.css";

import {
  VectorEditorCanvas,
  type Frame,
  type PointKind,
} from "./vector-editor-canvas";
import { VectorNodeControls } from "./vector-node-controls";
type Gesture = {
  conceptId: string;
  original: VectorPath[];
  preview: VectorPath[];
  pathId: string;
  contourIndex: number;
  nodeId: string;
  kind: PointKind;
  mode: "pointer" | "keyboard";
  pointerId?: number;
};
const clamp = (number: number) =>
  Math.round(Math.min(1000, Math.max(-1000, number)) * 1000) / 1000;
function fitFrame(paths: VectorPath[]): Frame {
  const xs = [-100, 100],
    ys = [-100, 100];
  for (const path of paths)
    for (const contour of path.contours)
      for (const node of contour.nodes) {
        xs.push(node.x);
        ys.push(node.y);
        if (node.inX !== undefined) {
          xs.push(node.inX);
          ys.push(node.inY!);
        }
        if (node.outX !== undefined) {
          xs.push(node.outX);
          ys.push(node.outY!);
        }
      }
  const lowX = Math.min(...xs),
    highX = Math.max(...xs),
    lowY = Math.min(...ys),
    highY = Math.max(...ys);
  const side = Math.max(highX - lowX, highY - lowY) + 40;
  return {
    x: (lowX + highX - side) / 2,
    y: (lowY + highY - side) / 2,
    width: side,
    height: side,
  };
}

export function VectorEditor({ studio }: { studio: StudioState }) {
  const concept = studio.selectedConcept;
  const document = concept?.document;
  const sourcePaths = document?.paths;
  const [draft, setDraft] = useState<VectorPath[] | null>(null);
  const [pathId, setPathId] = useState<string | null>(
    sourcePaths?.[0]?.id ?? null,
  );
  const [contourIndex, setContourIndex] = useState(0);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [frame, setFrame] = useState<Frame>(() => fitFrame(sourcePaths ?? []));
  const [error, setError] = useState("");
  const [gestureActive, setGestureActive] = useState(false);
  const [committing, setCommitting] = useState(false);
  const committingRef = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const latest = useRef({ conceptId: concept?.id, paths: sourcePaths });
  latest.current = { conceptId: concept?.id, paths: sourcePaths };
  useEffect(() => {
    gesture.current = null;
    setGestureActive(false);
    setDraft(null);
    setPathId(null);
    setNodeId(null);
    setContourIndex(0);
    setError("");
    setFrame(fitFrame(latest.current.paths ?? []));
  }, [concept?.id]);
  const paths = draft ?? sourcePaths ?? [];
  const path = paths.find((item) => item.id === pathId) ?? paths[0];
  const contourPosition = Math.min(
    contourIndex,
    Math.max(0, (path?.contours.length ?? 1) - 1),
  );
  const contour = path?.contours[contourPosition];
  const node =
    contour?.nodes.find((item) => item.id === nodeId) ?? contour?.nodes[0];
  const disabled = studio.busy || gestureActive || committing;
  const setSelection = (
    selectedPath: VectorPath,
    index = 0,
    selectedNode?: VectorNode,
  ) => {
    setPathId(selectedPath.id);
    setContourIndex(index);
    setNodeId(
      selectedNode?.id ?? selectedPath.contours[index]?.nodes[0]?.id ?? null,
    );
  };
  const report = (issue: unknown) =>
    setError(issue instanceof Error ? issue.message : String(issue));
  const commit = async (next: VectorPath[]) => {
    if (!concept || studio.busy || committingRef.current) return;
    setError("");
    committingRef.current = true;
    setCommitting(true);
    try {
      await studio.updateConcept({ paths: next, symbolSource: "custom" });
    } finally {
      committingRef.current = false;
      setCommitting(false);
    }
  };
  const edit = (change: () => VectorPath[]) => {
    if (disabled || committingRef.current) return;
    try {
      void commit(change()).catch(report);
    } catch (issue) {
      report(issue);
    }
  };
  const cancelGesture = () => {
    gesture.current = null;
    setGestureActive(false);
    setDraft(null);
  };
  const finishGesture = () => {
    const current = gesture.current;
    if (!current) return;
    gesture.current = null;
    setGestureActive(false);
    setDraft(null);
    if (
      latest.current.conceptId !== current.conceptId ||
      latest.current.paths !== current.original
    ) {
      setError(
        "The composition changed during this edit. Try the gesture again.",
      );
      return;
    }
    if (current.preview !== current.original) void commit(current.preview);
  };
  const coordinate = (event: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current,
      matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const mapped = point.matrixTransform(matrix.inverse());
    return Number.isFinite(mapped.x) && Number.isFinite(mapped.y)
      ? { x: clamp(mapped.x), y: clamp(mapped.y) }
      : null;
  };
  const updateGesture = (x: number, y: number) => {
    const current = gesture.current;
    if (!current) return;
    try {
      const next =
        current.kind === "anchor"
          ? moveNode(
              current.original,
              current.pathId,
              current.contourIndex,
              current.nodeId,
              x,
              y,
            )
          : moveHandle(
              current.original,
              current.pathId,
              current.contourIndex,
              current.nodeId,
              current.kind,
              x,
              y,
            );
      current.preview = next;
      setDraft(next);
      setError("");
    } catch (issue) {
      report(issue);
    }
  };
  const beginPointer = (
    event: PointerEvent<SVGCircleElement>,
    selectedPath: VectorPath,
    index: number,
    selectedNode: VectorNode,
    kind: PointKind,
  ) => {
    if (
      studio.busy ||
      committingRef.current ||
      !concept ||
      gesture.current ||
      !sourcePaths
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    svgRef.current?.focus();
    setSelection(selectedPath, index, selectedNode);
    gesture.current = {
      conceptId: concept.id,
      original: sourcePaths,
      preview: sourcePaths,
      pathId: selectedPath.id,
      contourIndex: index,
      nodeId: selectedNode.id,
      kind,
      mode: "pointer",
      pointerId: event.pointerId,
    };
    setGestureActive(true);
    svgRef.current?.setPointerCapture(event.pointerId);
  };
  const keyMove = (
    event: KeyboardEvent<SVGCircleElement>,
    selectedPath: VectorPath,
    index: number,
    selectedNode: VectorNode,
    kind: PointKind,
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelGesture();
      return;
    }
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
        event.key,
      ) ||
      studio.busy ||
      committingRef.current ||
      !concept ||
      !sourcePaths
    )
      return;
    event.preventDefault();
    setSelection(selectedPath, index, selectedNode);
    if (!gesture.current) {
      gesture.current = {
        conceptId: concept.id,
        original: sourcePaths,
        preview: sourcePaths,
        pathId: selectedPath.id,
        contourIndex: index,
        nodeId: selectedNode.id,
        kind,
        mode: "keyboard",
      };
      setGestureActive(true);
    }
    const current = gesture.current;
    if (current.mode !== "keyboard") return;
    const active = current.preview
      .find((item) => item.id === current.pathId)!
      .contours[current.contourIndex].nodes.find(
        (item) => item.id === current.nodeId,
      )!;
    const x =
      kind === "anchor"
        ? active.x
        : kind === "in"
          ? (active.inX ?? active.x)
          : (active.outX ?? active.x);
    const y =
      kind === "anchor"
        ? active.y
        : kind === "in"
          ? (active.inY ?? active.y)
          : (active.outY ?? active.y);
    const distance = event.altKey ? 0.1 : event.shiftKey ? 10 : 1;
    updateGesture(
      clamp(
        x +
          (event.key === "ArrowLeft"
            ? -distance
            : event.key === "ArrowRight"
              ? distance
              : 0),
      ),
      clamp(
        y +
          (event.key === "ArrowUp"
            ? -distance
            : event.key === "ArrowDown"
              ? distance
              : 0),
      ),
    );
  };
  const keyboardEnd = (event: KeyboardEvent<SVGCircleElement>) => {
    if (event.key.startsWith("Arrow") && gesture.current?.mode === "keyboard")
      finishGesture();
  };
  const zoom = (factor: number) =>
    setFrame((current) => {
      const width = Math.max(60, Math.min(2400, current.width * factor));
      return {
        x: current.x + (current.width - width) / 2,
        y: current.y + (current.height - width) / 2,
        width,
        height: width,
      };
    });
  if (!concept)
    return (
      <div className="editor-empty">
        <PenTool size={28} />
        <h2>Select a concept to edit</h2>
        <p>
          Editable vector paths stay separate from the original generated image.
        </p>
      </div>
    );
  if (document?.symbolSource !== "custom" || !paths.length)
    return (
      <div className="editor-empty">
        <PenTool size={28} />
        <h2>Edit the mark, point by point</h2>
        <p>
          Start with a vector path or convert an existing trace. Your original
          image stays intact.
        </p>
        <div className="editor-empty-actions">
          {paths.length > 0 && (
            <button
              type="button"
              className="primary-button"
              disabled={studio.busy}
              onClick={() =>
                void studio.updateConcept({ symbolSource: "custom" })
              }
            >
              Use saved editable paths
            </button>
          )}
          <button
            type="button"
            className="outline-button"
            disabled={studio.busy}
            onClick={() => void studio.startCustomSymbol()}
          >
            Start editable symbol
          </button>
          {concept.tracedSvg ? (
            <button
              type="button"
              className="outline-button"
              disabled={studio.busy}
              onClick={() => void studio.editTracedSymbol()}
            >
              Convert trace to editable paths
            </button>
          ) : concept.raster ? (
            <button
              type="button"
              className="outline-button"
              disabled={studio.busy}
              onClick={() => void studio.vectorizeConcept()}
            >
              Trace image first
            </button>
          ) : null}
        </div>
        <p className="field-help">
          Trace conversion preserves supported paths and refuses unsupported SVG
          content.
        </p>
      </div>
    );
  return (
    <section className="vector-editor" aria-label="Vector path editor">
      <div className="vector-editor-toolbar">
        <div>
          <PenTool size={17} />
          <strong>Path editor</strong>
          <span>
            {paths.length} {paths.length === 1 ? "path" : "paths"}
          </span>
        </div>
        <div className="editor-toolbar-actions">
          <button
            className="icon-button"
            type="button"
            aria-label="Undo vector edit"
            disabled={disabled || !studio.canUndo}
            onClick={() => void studio.undoConcept()}
          >
            <Undo2 size={16} />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="Redo vector edit"
            disabled={disabled || !studio.canRedo}
            onClick={() => void studio.redoConcept()}
          >
            <Redo2 size={16} />
          </button>
          <span className="tool-divider" />
          <button
            className="icon-button"
            type="button"
            aria-label="Zoom out vector editor"
            disabled={gestureActive}
            onClick={() => zoom(1.25)}
          >
            <Minus size={15} />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="Zoom in vector editor"
            disabled={gestureActive}
            onClick={() => zoom(0.8)}
          >
            <Plus size={15} />
          </button>
          <button
            className="outline-button"
            type="button"
            disabled={gestureActive}
            onClick={() => setFrame(fitFrame(paths))}
          >
            <Maximize size={13} />
            Fit paths
          </button>
        </div>
      </div>
      {error && (
        <p className="editor-error" role="alert">
          {error}
        </p>
      )}
      <div className="vector-editor-body">
        <VectorEditorCanvas
          svgRef={svgRef}
          frame={frame}
          paths={paths}
          path={path}
          node={node}
          contourPosition={contourPosition}
          setSelection={setSelection}
          beginPointer={beginPointer}
          keyMove={keyMove}
          keyboardEnd={keyboardEnd}
          onKeyDown={(event) => {
            if (event.key === "Escape" && gesture.current) {
              event.preventDefault();
              cancelGesture();
            }
          }}
          onKeyboardBlur={() => {
            if (gesture.current?.mode === "keyboard") finishGesture();
          }}
          onPointerMove={(event) => {
            if (
              gesture.current?.mode === "pointer" &&
              gesture.current.pointerId === event.pointerId
            ) {
              const point = coordinate(event);
              if (point) updateGesture(point.x, point.y);
            }
          }}
          onPointerUp={(event) => {
            if (
              gesture.current?.mode === "pointer" &&
              gesture.current.pointerId === event.pointerId
            ) {
              finishGesture();
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
          onPointerCancel={cancelGesture}
          onLostPointerCapture={() => {
            if (gesture.current?.mode === "pointer") cancelGesture();
          }}
        />
        <VectorNodeControls
          paths={paths}
          path={path}
          contour={contour}
          node={node}
          contourPosition={contourPosition}
          disabled={disabled}
          primary={document?.primary}
          setSelection={setSelection}
          setContourIndex={setContourIndex}
          setNodeId={setNodeId}
          edit={edit}
        />
      </div>
    </section>
  );
}
