import type { Concept } from "../domain/types";
import type { StudioState } from "./ui";

export function RefinementHistory({
  concept,
  studio,
}: {
  concept: Concept;
  studio: StudioState;
}) {
  const source = studio.workspace.concepts.find(
    (c) => c.id === concept.derivedFrom,
  );
  const history = studio.workspace.concepts
    .filter((c) => c.brandId === concept.brandId && c.refinement)
    .slice()
    .reverse();
  if (!source && !history.length) return null;
  return (
    <div className="refinement-history">
      <h3>Refinement versions</h3>
      {concept.refinement &&
        (source ? (
          <button
            type="button"
            className="subtle-button"
            disabled={studio.busy}
            onClick={() => studio.selectConcept(source.id)}
          >
            Open source: {source.name}
          </button>
        ) : (
          <p className="field-help">
            Source concept is unavailable. Its before snapshot is preserved.
          </p>
        ))}
      <div>
        {history.map((item) => (
          <button
            type="button"
            key={item.id}
            className="refinement-history-item"
            aria-pressed={item.id === concept.id}
            disabled={studio.busy}
            onClick={() => studio.selectConcept(item.id)}
          >
            <span>{item.name}</span>
            <small>
              {item.refinement!.kind === "ai" ? "AI" : "Exact edit"} ·{" "}
              {new Date(item.createdAt).toLocaleString()}
            </small>
          </button>
        ))}
      </div>
    </div>
  );
}
