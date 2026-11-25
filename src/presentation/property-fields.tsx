import { useEffect, useRef, useState, type ChangeEvent } from "react";
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
  return (
    <label className="color-field">
      <input
        aria-label={`${label} color`}
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <span>{label}</span>
      <code>{value.toUpperCase()}</code>
    </label>
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
