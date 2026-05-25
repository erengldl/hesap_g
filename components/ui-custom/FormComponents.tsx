"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";

type FieldChromeProps = {
  label: string;
  error?: string;
  hint?: ReactNode;
  containerClassName?: string;
  labelClassName?: string;
};

function FieldMeta({ error, hint }: { error?: string; hint?: ReactNode }) {
  if (error) {
    return (
      <p className="mt-1.5 flex items-center gap-1 text-[10px] text-danger">
        <AlertCircle className="h-3 w-3" />
        {error}
      </p>
    );
  }

  if (hint) {
    return <div className="mt-1.5 text-xs text-muted">{hint}</div>;
  }

  return null;
}

type FormFieldProps = FieldChromeProps &
  InputHTMLAttributes<HTMLInputElement> & {
    inputClassName?: string;
  };

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(function FormField(
  { label, error, hint, containerClassName, labelClassName, inputClassName, className, id, ...props },
  ref
) {
  return (
    <div className={cn("space-y-2", containerClassName)}>
      <label htmlFor={id} className={cn("form-label", labelClassName)}>
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        className={cn("form-input", error && "border-danger/50", inputClassName, className)}
        aria-invalid={Boolean(error)}
        {...props}
      />
      <FieldMeta error={error} hint={hint} />
    </div>
  );
});

type FormSelectProps = FieldChromeProps &
  SelectHTMLAttributes<HTMLSelectElement> & {
    selectClassName?: string;
  };

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(function FormSelect(
  { label, error, hint, containerClassName, labelClassName, selectClassName, className, id, children, ...props },
  ref
) {
  return (
    <div className={cn("space-y-2", containerClassName)}>
      <label htmlFor={id} className={cn("form-label", labelClassName)}>
        {label}
      </label>
      <select
        ref={ref}
        id={id}
        className={cn("form-select", error && "border-danger/50", selectClassName, className)}
        aria-invalid={Boolean(error)}
        {...props}
      >
        {children}
      </select>
      <FieldMeta error={error} hint={hint} />
    </div>
  );
});

type FormTextareaProps = FieldChromeProps &
  TextareaHTMLAttributes<HTMLTextAreaElement> & {
    textareaClassName?: string;
  };

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(function FormTextarea(
  { label, error, hint, containerClassName, labelClassName, textareaClassName, className, id, ...props },
  ref
) {
  return (
    <div className={cn("space-y-2", containerClassName)}>
      <label htmlFor={id} className={cn("form-label", labelClassName)}>
        {label}
      </label>
      <textarea
        ref={ref}
        id={id}
        className={cn("form-textarea", error && "border-danger/50", textareaClassName, className)}
        aria-invalid={Boolean(error)}
        {...props}
      />
      <FieldMeta error={error} hint={hint} />
    </div>
  );
});
