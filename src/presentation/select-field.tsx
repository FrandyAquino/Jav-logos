import { useRef, useState } from "react";
import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  fontFamily?: string;
}

export function SelectField({
  label,
  value,
  onValueChange,
  options,
  disabled = false,
  placeholder = "Choose an option",
  className = "",
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState("dark");
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = options[selectedIndex];

  return (
    <Select.Root
      open={open}
      onOpenChange={(next) => {
        if (next)
          setTheme(
            trigger.current
              ?.closest("[data-theme]")
              ?.getAttribute("data-theme") ?? "dark",
          );
        setOpen(next);
      }}
      value={selectedIndex < 0 ? "" : String(selectedIndex)}
      onValueChange={(index) => {
        const option = options[Number(index)];
        if (option) onValueChange(option.value);
      }}
      disabled={disabled}
    >
      <Select.Trigger
        ref={trigger}
        className={`select-trigger ${className}`}
        aria-label={label}
      >
        <Select.Value placeholder={placeholder}>
          {selected && (
            <span
              style={
                selected.fontFamily
                  ? { fontFamily: selected.fontFamily }
                  : undefined
              }
            >
              {selected.label}
            </span>
          )}
        </Select.Value>
        <Select.Icon className="select-chevron">
          <ChevronDown size={14} aria-hidden="true" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className="select-content"
          aria-label={label}
          data-theme={theme}
          position="popper"
          sideOffset={6}
          collisionPadding={12}
        >
          <Select.ScrollUpButton className="select-scroll">
            <ChevronUp size={14} aria-hidden="true" />
          </Select.ScrollUpButton>
          <Select.Viewport className="select-viewport">
            {options.map((option, index) => (
              <Select.Item
                className="select-option"
                key={option.value}
                value={String(index)}
                textValue={option.label}
                aria-label={option.label}
              >
                <span className="select-option-copy">
                  <Select.ItemText>
                    <span
                      className="select-option-label"
                      style={
                        option.fontFamily
                          ? { fontFamily: option.fontFamily }
                          : undefined
                      }
                    >
                      {option.label}
                    </span>
                  </Select.ItemText>
                  {option.description && (
                    <span className="select-option-description">
                      {option.description}
                    </span>
                  )}
                </span>
                <Select.ItemIndicator className="select-check">
                  <Check size={15} aria-hidden="true" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className="select-scroll">
            <ChevronDown size={14} aria-hidden="true" />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
