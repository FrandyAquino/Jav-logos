import { useState } from "react";
import { Dna, SlidersHorizontal } from "lucide-react";
import type { StudioState } from "./ui";
import { DnaInspector } from "./dna-inspector";
import { ConceptInspector } from "./concept-inspector";
export function Inspector({ studio }: { studio: StudioState }) {
  const [tab, setTab] = useState<"dna" | "design">("dna");
  return (
    <aside className="inspector panel" aria-label="Properties inspector">
      <div
        className="inspector-tabs"
        role="tablist"
        aria-label="Inspector sections"
        onKeyDown={(event) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            const next =
              event.key === "Home"
                ? "dna"
                : event.key === "End"
                  ? "design"
                  : tab === "dna"
                    ? "design"
                    : "dna";
            setTab(next);
            document.getElementById(`${next}-tab`)?.focus();
          }
        }}
      >
        <button
          id="dna-tab"
          type="button"
          role="tab"
          aria-controls="dna-panel"
          aria-selected={tab === "dna"}
          tabIndex={tab === "dna" ? 0 : -1}
          onClick={() => setTab("dna")}
        >
          <Dna size={14} /> Brand DNA
        </button>
        <button
          id="design-tab"
          type="button"
          role="tab"
          aria-controls="design-panel"
          aria-selected={tab === "design"}
          tabIndex={tab === "design" ? 0 : -1}
          onClick={() => setTab("design")}
        >
          <SlidersHorizontal size={14} /> Design
        </button>
      </div>
      <div
        className="inspector-scroll"
        role="tabpanel"
        id={tab === "dna" ? "dna-panel" : "design-panel"}
        aria-labelledby={tab === "dna" ? "dna-tab" : "design-tab"}
      >
        {tab === "dna" ? (
          <DnaInspector key={studio.selectedBrand?.id} studio={studio} />
        ) : (
          <ConceptInspector key={studio.selectedConcept?.id} studio={studio} />
        )}
      </div>
    </aside>
  );
}
