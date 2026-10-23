import { forwardRef, useId, type SelectHTMLAttributes } from "react";
import { AlertCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GlassSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
}

export const GlassSelect = forwardRef<HTMLSelectElement, GlassSelectProps>(function GlassSelect(
  { className, label, hint, error, options, id, ...props }, ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  return (
    <div className={cn("field", "form-field", error && "field-error", className)}>
      <label htmlFor={selectId}>{label}</label>
      <div className="field-control form-control-wrap select-control">
        <select ref={ref} id={selectId} className="form-control" aria-invalid={Boolean(error)} aria-describedby={error || hint ? `${selectId}-message` : undefined} {...props}>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <ChevronDown size={16} aria-hidden />
      </div>
      {(error || hint) && <span className={cn("field-message", error && "field-message-error")} id={`${selectId}-message`} role={error ? "alert" : undefined}>{error && <AlertCircle size={13} />} {error ?? hint}</span>}
    </div>
  );
});
