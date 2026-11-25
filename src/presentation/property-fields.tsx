import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import * as Popover from "@radix-ui/react-popover";
import { HexColorPicker } from "react-colorful";
export function RangeField({
  label,
  value,
  min,
  max,
  step,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit: (value: number) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const active = useRef(false);
  const submitting = useRef<number | null>(null);
  useEffect(() => {
    if (!active.current) setDraft(value);
  }, [value]);
  const commit = () => {
    if (draft !== value && submitting.current !== draft) {
      submitting.current = draft;
      void onCommit(draft).finally(() => {
        submitting.current = null;
      });
    }
  };
  return (
    <input
      aria-label={label}
      type="range"
      min={min}
      max={max}
      step={step}
      value={draft}
      onFocus={() => {
        active.current = true;
      }}
      onChange={(event) => setDraft(event.target.valueAsNumber)}
      onPointerUp={commit}
      onPointerCancel={commit}
      onKeyUp={commit}
      onBlur={() => {
        active.current = false;
        commit();
      }}
    />
  );
}
export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [draft, setDraft] = useState(value);
  const [hex, setHex] = useState(value.toUpperCase());
  const valid = /^#?[0-9a-fA-F]{6}$/.test(hex);
  const changeDraft = (next: string) => {
    setDraft(next);
    setHex(next.toUpperCase());
  };
  const changeOpen = (next: boolean) => {
    if (next) {
      setTheme(
        trigger.current?.closest("[data-theme]")?.getAttribute("data-theme") ??
          "dark",
      );
      changeDraft(value);
    }
    setOpen(next);
  };
  return (
    <Popover.Root open={open} onOpenChange={changeOpen}>
      <Popover.Trigger asChild>
        <button
          ref={trigger}
          type="button"
          className="color-field color-field-control"
          aria-label={`${label} color`}
        >
          <span
            className="color-field-swatch"
            style={{ background: value }}
            aria-hidden="true"
          />
          <span>{label}</span>
          <code>{value.toUpperCase()}</code>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="color-popover"
          data-theme={theme}
          side="left"
          align="start"
          sideOffset={10}
          collisionPadding={12}
          aria-labelledby={titleId}
        >
          <span id={titleId} className="color-popover-title">
            {label} color
          </span>
          <HexColorPicker color={draft} onChange={changeDraft} />
          <label className="color-hex-field">
            <span>Hex</span>
            <input
              aria-label={`${label} hex value`}
              value={hex}
              spellCheck={false}
              autoComplete="off"
              maxLength={7}
              aria-invalid={!valid}
              onChange={(event) => {
                const next = event.target.value;
                setHex(next);
                if (/^#?[0-9a-fA-F]{6}$/.test(next))
                  setDraft(`#${next.replace(/^#/, "")}`);
              }}
            />
          </label>
          <p className="color-picker-help">
            Use a six-digit hex color. Changes apply when you choose Apply.
          </p>
          <div className="color-picker-actions">
            <Popover.Close asChild>
              <button type="button" className="subtle-button">
                Cancel
              </button>
            </Popover.Close>
            <button
              type="button"
              className="primary-button"
              disabled={!valid}
              onClick={() => {
                setOpen(false);
                if (draft.toLowerCase() !== value.toLowerCase())
                  onChange(draft);
              }}
            >
              Apply
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function TextField({
  label,
  value,
  maxLength,
  multiline = false,
  onCommit,
}: {
  label: string;
  value: string;
  maxLength: number;
  multiline?: boolean;
  onCommit: (value: string) => unknown;
}) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);
  const props = {
    "aria-label": label,
    value: draft,
    maxLength,
    onFocus: () => {
      focused.current = true;
    },
    onBlur: () => {
      focused.current = false;
      if (draft !== value) void onCommit(draft);
    },
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(event.target.value),
  };
  return multiline ? (
    <textarea {...props} rows={3} />
  ) : (
    <input
      {...props}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}
