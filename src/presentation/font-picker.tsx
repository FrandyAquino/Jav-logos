import { FONTS } from "../domain/brand-dna";
import { SelectField } from "./select-field";

export function FontPicker({
  label,
  value,
  onValueChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <SelectField
      label={label}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      className="font-picker-trigger"
      options={FONTS.map((font) => ({
        value: font,
        label: font,
        fontFamily: font,
        description:
          font === "system-ui"
            ? "System interface"
            : /Mono|Courier/.test(font)
              ? "Monospace"
              : /Georgia|Garamond|Playfair/.test(font)
                ? "Serif"
                : "Sans serif",
      }))}
    />
  );
}
