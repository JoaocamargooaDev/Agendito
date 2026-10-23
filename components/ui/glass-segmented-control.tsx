"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string> { value: T; label: string }
export interface GlassSegmentedControlProps<T extends string> {
  label: string;
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}

export function GlassSegmentedControl<T extends string>({ label, value, options, onChange, className }: GlassSegmentedControlProps<T>) {
  const id = useId();
  return (
    <div className={cn("segmented-field", className)}>
      <span className="segmented-label" id={`${id}-label`}>{label}</span>
      <div className="segmented-control" role="radiogroup" aria-labelledby={`${id}-label`}>
        {options.map((option) => (
          <label key={option.value} className={cn("segment", value === option.value && "segment-active")}>
            <input id={`${id}-${option.value}`} type="radio" name={id} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
