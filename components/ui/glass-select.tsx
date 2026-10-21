import { forwardRef, useId, type SelectHTMLAttributes } from "react";
import { AlertCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GlassSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
}

export const GlassSelect = forwardRef<HTMLSelectElement, GlassSelectProps>(function GlassSelect(
  { className, label, error, options, id, ...props }, ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  return (
    <div className={cn("field", error && "field-error", className)}>
      <label htmlFor={selectId}>{label}</label>
      <div className="field-control select-control">
        <select ref={ref} id={selectId} aria-invalid={Boolean(error)} {...props}>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <ChevronDown size={16} aria-hidden />
      </div>
      {error && <span className="field-message"><AlertCircle size={13} /> {error}</span>}
    </div>
  );
});
