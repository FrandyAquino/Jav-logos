import { useState } from "react";
import { SelectField } from "./select-field";
import type { StudioState } from "./ui";
import { ViewEmpty, ViewHeading } from "./studio-views/view-primitives";
import { RefinementEditor } from "./refinement-editor";
import { RefinementHistory } from "./refinement-history";
import "./refinement.css";

export function RefinementView({ studio }: { studio: StudioState }) {
  const concept = studio.selectedConcept;
  const [surround, setSurround] = useState("paper");
  const [mode, setMode] = useState<"composition" | "ai">("composition");
  const concepts = studio.workspace.concepts.filter(
    (c) => c.brandId === studio.selectedBrandId,
  );
  return (
    <section className="refinement-view" aria-label="Directed refinement">
      <ViewHeading
        title="Refine this direction"
        description="Make an exact composition edit or reinterpret its symbol locally. Each result is saved separately."
      />
      {!concept ? (
        <ViewEmpty title="Choose a concept">
          Select a saved logo to begin refining it.
        </ViewEmpty>
      ) : (
        <>
          <div className="refinement-toolbar">
            <SelectField
              label="Refinement source"
              value={concept.id}
              disabled={studio.busy}
              onValueChange={studio.selectConcept}
              options={concepts.map((c) => ({
                value: c.id,
                label: c.name,
                description:
                  c.refinement?.kind === "ai"
                    ? "AI refinement"
                    : c.refinement
                      ? "Exact edit"
                      : "Source",
              }))}
            />
            <div
              className="segmented-control"
              role="group"
              aria-label="Refinement method"
            >
              <button
                type="button"
                aria-pressed={mode === "composition"}
                className={mode === "composition" ? "active" : ""}
                disabled={studio.busy}
                onClick={() => setMode("composition")}
              >
                Exact edit
              </button>
              <button
                type="button"
                aria-pressed={mode === "ai"}
                className={mode === "ai" ? "active" : ""}
                disabled={studio.busy}
                onClick={() => setMode("ai")}
              >
                Local AI
              </button>
            </div>
          </div>
          <SelectField
            label="Refinement surround"
            value={surround}
            onValueChange={setSurround}
            options={[
              { value: "paper", label: "Paper surround" },
              { value: "dark", label: "Dark surround" },
              { value: "grid", label: "Checkerboard surround" },
            ]}
          />
          <RefinementEditor
            key={concept.id}
            concept={concept}
            studio={studio}
            mode={mode}
            surround={surround}
          />
          <RefinementHistory concept={concept} studio={studio} />
        </>
      )}
    </section>
  );
}
