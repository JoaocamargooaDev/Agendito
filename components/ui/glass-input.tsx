import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  leadingIcon?: ReactNode;
  trailingAction?: ReactNode;
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(function GlassInput(
  { className, label, hint, error, leadingIcon, trailingAction, id, ...props }, ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = `${inputId}-description`;
  return (
    <div className={cn("field", "form-field", error && "field-error", className)}>
      <label htmlFor={inputId}>{label}</label>
      <div className="field-control form-control-wrap">
        {leadingIcon && <span className="field-icon">{leadingIcon}</span>}
        <input ref={ref} id={inputId} className="form-control" aria-invalid={Boolean(error)} aria-describedby={(error || hint) ? descriptionId : undefined} {...props} />
        {trailingAction}
      </div>
      {(error || hint) && <span id={descriptionId} className={cn("field-message", error && "field-message-error") } role={error ? "alert" : undefined}>{error && <AlertCircle size={13} />} {error ?? hint}</span>}
    </div>
  );
});
