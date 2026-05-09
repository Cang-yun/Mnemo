import { ChevronDown } from "lucide-react";
import { useState } from "react";

interface SelectOption<T extends string> {
  value: T;
  label: string;
  swatch?: string;
}

interface SelectProps<T extends string> {
  value: T;
  options: SelectOption<T>[];
  onChange(value: T): void;
  ariaLabel: string;
  className?: string;
}

export function Select<T extends string>({ value, options, onChange, ariaLabel, className }: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const active = options.find((o) => o.value === value);
  const label = active?.label ?? value;
  const swatch = active?.swatch;

  return (
    <div
      className={`select-picker ${className ?? ""}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        className="select-trigger"
        onClick={() => setOpen((c) => !c)}
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        {swatch ? <span className="swatch" style={{ background: swatch }} /> : null}
        <span>{label}</span>
        <ChevronDown size={15} />
      </button>
      {open ? (
        <div className="select-menu" role="listbox">
          {options.map((opt) => (
            <button
              type="button"
              key={opt.value}
              className={opt.value === value ? "active" : ""}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.swatch ? <span className="swatch" style={{ background: opt.swatch }} /> : null}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
