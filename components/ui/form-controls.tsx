import { useId, type FieldsetHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ChoiceInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: ReactNode;
  description?: ReactNode;
  error?: string;
};

export function GlassTextarea({ label, hint, error, id, className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string; error?: string }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  return <div className={cn("field form-field", error && "field-error", className)}>
    <label htmlFor={inputId}>{label}</label>
    <textarea id={inputId} className="form-control form-textarea" aria-invalid={Boolean(error)} aria-describedby={error || hint ? messageId : undefined} {...props} />
    {(error || hint) && <span id={messageId} className={cn("field-message", error && "field-message-error")} role={error ? "alert" : undefined}>{error ? <AlertCircle size={13} /> : null}{error ?? hint}</span>}
  </div>;
}

export function CheckboxField({ label, description, error, id, className, ...props }: ChoiceInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  return <div className={cn("choice-field", "checkbox-field", error && "field-error", className)}>
    <label htmlFor={inputId} className="choice-control"><input {...props} id={inputId} type="checkbox" aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} /><span className="choice-copy"><span>{label}</span>{description && <small>{description}</small>}</span></label>
    {error && <span className="field-message field-message-error" id={errorId} role="alert"><AlertCircle size={13} />{error}</span>}
  </div>;
}

export function RadioField({ label, description, error, id, className, ...props }: ChoiceInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  return <div className={cn("choice-field", "radio-field", error && "field-error", className)}>
    <label htmlFor={inputId} className="choice-control"><input {...props} id={inputId} type="radio" aria-describedby={error ? errorId : undefined} /><span className="choice-copy"><span>{label}</span>{description && <small>{description}</small>}</span></label>
    {error && <span className="field-message field-message-error" id={errorId} role="alert"><AlertCircle size={13} />{error}</span>}
  </div>;
}

export function SwitchField({ label, description, error, id, className, ...props }: ChoiceInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  return <div className={cn("choice-field", "switch-field", error && "field-error", className)}>
    <label htmlFor={inputId} className="choice-control"><input {...props} id={inputId} type="checkbox" role="switch" aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} /><span className="choice-copy"><span>{label}</span>{description && <small>{description}</small>}</span></label>
    {error && <span className="field-message field-message-error" id={errorId} role="alert"><AlertCircle size={13} />{error}</span>}
  </div>;
}

export function FieldGroup({ children, className, ...props }: FieldsetHTMLAttributes<HTMLFieldSetElement>) {
  return <fieldset className={cn("form-field-group", className)} {...props}>{children}</fieldset>;
}

export function FormSection({ title, description, children, className }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return <section className={cn("form-section", className)}><header className="form-section-heading"><h3>{title}</h3>{description && <p>{description}</p>}</header><div className="form-section-content">{children}</div></section>;
}

export function FieldError({ children, className }: { children?: ReactNode; className?: string }) {
  if (!children) return null;
  return <p className={cn("field-message field-message-error", className)} role="alert"><AlertCircle size={13} />{children}</p>;
}
