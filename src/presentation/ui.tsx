import type { ReactNode } from "react";
import type { useStudio } from "../application/use-studio";
import { FONTS } from "../domain/brand-dna";
import { SHAPES } from "../domain/vector";

export type StudioState = ReturnType<typeof useStudio>;
export const shapes = SHAPES;
export const fonts = FONTS;
export const svgUrl = (svg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
export const rasterUrl = (raster: string) =>
  raster.startsWith("data:") ? raster : `data:image/png;base64,${raster}`;

export function Mark({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={small ? "studio-mark small" : "studio-mark"}
      viewBox="0 0 40 40"
      aria-hidden="true"
    >
      <path
        d="m20 3 8 8-8 8-8-8Zm9 9 8 8-8 8-8-8ZM11 12l8 8-8 8-8-8Zm9 9 8 8-8 8-8-8Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function IconButton({
  label,
  onClick,
  children,
  disabled = false,
  active = false,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${active ? "active" : ""}`}
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="field">
      <div className="field-label">
        {label}
        {hint}
      </div>
      {children}
    </div>
  );
}
