import type { ReactNode } from "react";
import type { Concept } from "../../domain/types";
import { SelectField } from "../select-field";
export type ArtworkMode = "vector" | "image";
export function ViewHeading({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="exploration-heading">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {children && (
        <div className="exploration-heading-actions">{children}</div>
      )}
    </header>
  );
}
export function ViewEmpty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="exploration-empty">
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function ArtworkModeSelect({
  value,
  onChange,
}: {
  value: ArtworkMode;
  onChange: (value: ArtworkMode) => void;
}) {
  return (
    <SelectField
      label="Preview artwork source"
      value={value}
      onValueChange={(v) => onChange(v as ArtworkMode)}
      options={[
        { value: "vector", label: "Editable compositions" },
        { value: "image", label: "Originals / vector studies" },
      ]}
    />
  );
}
export function artworkLabel(concept: Concept, mode: ArtworkMode) {
  return mode === "image" && concept.raster
    ? "Original generated image"
    : "Editable composition";
}
export function supportsMonochrome(concept: Concept) {
  return (
    !concept.document.symbolSource ||
    ["geometric", "custom"].includes(concept.document.symbolSource)
  );
}
