import type { RefObject } from "react";
import { RotateCcw } from "lucide-react";
import {
  mockupScene,
  type MockupSettings,
  type MockupSource,
} from "../../domain/mockups";
import { ColorField, RangeField } from "../property-fields";
import { SelectField, type SelectOption } from "../select-field";
export function MockupAppearanceControls({
  settings,
  update,
  effectiveSource,
  setSource,
  options,
  exporting,
  settingsPanel,
}: {
  settings: MockupSettings;
  update: (patch: Partial<MockupSettings>) => void;
  effectiveSource: MockupSource;
  setSource: (source: MockupSource) => void;
  options: SelectOption[];
  exporting: boolean;
  settingsPanel: RefObject<HTMLFieldSetElement | null>;
}) {
  const digital = mockupScene(settings.scene).category === "Digital";
  return (
    <fieldset
      ref={settingsPanel}
      className="mockup-controls"
      disabled={exporting}
    >
      <legend className="visually-hidden">Mockup appearance</legend>
      <div>
        <label className="mockup-field-label">Artwork</label>
        <SelectField
          label="Mockup artwork"
          value={effectiveSource}
          disabled={exporting}
          onValueChange={(value) => setSource(value as MockupSource)}
          options={options}
        />
      </div>
      <div>
        <label className="mockup-field-label">Studio background</label>
        <SelectField
          label="Mockup backdrop"
          value={settings.backdrop}
          disabled={exporting}
          onValueChange={(value) =>
            update({ backdrop: value as MockupSettings["backdrop"] })
          }
          options={[
            { value: "warm", label: "Warm stone" },
            { value: "cool", label: "Cool grey" },
            { value: "dark", label: "Graphite" },
          ]}
        />
      </div>
      <div>
        <label className="mockup-field-label">Surface</label>
        <ColorField
          label="Mockup surface"
          value={settings.surface}
          onChange={(surface) => update({ surface })}
        />
      </div>
      <div>
        <label className="mockup-field-label">Finish</label>
        <SelectField
          label="Mockup print finish"
          value={digital ? "ink" : settings.finish}
          disabled={digital || exporting}
          onValueChange={(value) =>
            update({ finish: value as MockupSettings["finish"] })
          }
          options={[
            { value: "ink", label: "Original colours" },
            { value: "foil", label: "Gold foil" },
          ]}
        />
      </div>
      <label className="mockup-size">
        Logo size <output>{Math.round(settings.scale * 100)}%</output>
        <RangeField
          label="Mockup logo size"
          value={settings.scale}
          min={0.55}
          max={1.15}
          step={0.05}
          onCommit={async (scale) => update({ scale })}
        />
      </label>
      <div className="mockup-placement">
        <label className="mockup-field-label">Placement</label>
        <div>
          <button
            type="button"
            className="subtle-button"
            onClick={() =>
              update({ offsetY: Math.min(0.25, settings.offsetY + 0.1) })
            }
          >
            Up
          </button>
          <button
            type="button"
            className="subtle-button"
            onClick={() =>
              update({ offsetY: Math.max(-0.25, settings.offsetY - 0.1) })
            }
          >
            Down
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Reset mockup placement"
            onClick={() => update({ offsetX: 0, offsetY: 0, scale: 1 })}
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>
    </fieldset>
  );
}
