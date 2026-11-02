"use client";

import { forwardRef, useId } from "react";

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const AdminField = forwardRef<HTMLInputElement, FieldProps>(
  ({ label, error, hint, className = "", ...rest }, ref) => {
    const generated = useId();
    const id = rest.id || generated;
    return (
      <div>
        <label
          htmlFor={id}
          className="mb-1.5 block text-xs font-medium text-ink-dim"
        >
          {label}
          {rest.required && <span className="ml-1 text-orange-400">*</span>}
        </label>
        <input
          ref={ref}
          {...rest}
          id={id}
          aria-invalid={!!error}
          className={`w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 text-sm text-white placeholder:text-ink-faint transition-all focus:border-orange-500/30 focus:outline-none focus:ring-1 focus:ring-orange-500/15 disabled:opacity-40 ${
            error
              ? "border-rose-500/40 focus:border-rose-500/50 focus:ring-rose-500/20"
              : ""
          } ${className}`}
        />
        {hint && !error && (
          <p className="mt-1.5 text-xs text-ink-faint">{hint}</p>
        )}
        {error && <p className="mt-1.5 text-xs text-rose-400">{error}</p>}
      </div>
    );
  },
);
AdminField.displayName = "AdminField";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const AdminTextarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = "", ...rest }, ref) => {
    const generated = useId();
    const id = rest.id || generated;
    return (
      <div>
        <label
          htmlFor={id}
          className="mb-1.5 block text-xs font-medium text-ink-dim"
        >
          {label}
          {rest.required && <span className="ml-1 text-orange-400">*</span>}
        </label>
        <textarea
          ref={ref}
          {...rest}
          id={id}
          aria-invalid={!!error}
          className={`w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 text-sm text-white placeholder:text-ink-faint transition-all focus:border-orange-500/30 focus:outline-none focus:ring-1 focus:ring-orange-500/15 disabled:opacity-40 ${
            error
              ? "border-rose-500/40 focus:border-rose-500/50 focus:ring-rose-500/20"
              : ""
          } ${className}`}
        />
        {hint && !error && (
          <p className="mt-1.5 text-xs text-ink-faint">{hint}</p>
        )}
        {error && <p className="mt-1.5 text-xs text-rose-400">{error}</p>}
      </div>
    );
  },
);
AdminTextarea.displayName = "AdminTextarea";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const AdminSelect = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className = "", ...rest }, ref) => {
    const generated = useId();
    const id = rest.id || generated;
    return (
      <div>
        <label
          htmlFor={id}
          className="mb-1.5 block text-xs font-medium text-ink-dim"
        >
          {label}
          {rest.required && <span className="ml-1 text-orange-400">*</span>}
        </label>
        <select
          ref={ref}
          {...rest}
          id={id}
          aria-invalid={!!error}
          className={`w-full rounded-xl border border-white/[0.06] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-white transition-all focus:border-orange-500/30 focus:outline-none focus:ring-1 focus:ring-orange-500/15 ${
            error
              ? "border-rose-500/40 focus:border-rose-500/50 focus:ring-rose-500/20"
              : ""
          } ${className}`}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="mt-1.5 text-xs text-rose-400">{error}</p>}
      </div>
    );
  },
);
AdminSelect.displayName = "AdminSelect";

interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

export function AdminCheckbox({ label, checked, onChange }: CheckboxProps) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-white/15 bg-white/[0.05] accent-orange-500"
      />
      <span className="text-sm text-ink-dim">{label}</span>
    </label>
  );
}

/** Section divider with label */
export function AdminSection({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink-faint">
        {label}
      </span>
      <div className="h-px flex-1 bg-gradient-to-r from-white/[0.06] to-transparent" />
    </div>
  );
}
