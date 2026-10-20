"use client";

import React, { useState } from "react";
import { X } from "@/components/animated-icons";

/**
 * Shared primitives for the tabbed profile editor. Inputs use the minimal
 * underline style from the reference design: transparent background, single
 * bottom border that turns accent-colored on focus.
 */

const underline =
  "w-full bg-transparent border-0 border-b border-line py-2 text-sm text-fg placeholder:text-muted/60 focus:outline-none focus:border-accent transition-colors disabled:opacity-50";

export function ProfileField({
  label,
  required,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-xs font-semibold text-fg block mb-0.5">
        {label}
        {required && <span className="text-accent ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

export function UnderlineInput(
  props: React.InputHTMLAttributes<HTMLInputElement>
) {
  return <input {...props} className={`${underline} ${props.className ?? ""}`} />;
}

export function UnderlineTextarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  return (
    <textarea
      rows={2}
      {...props}
      className={`${underline} resize-none ${props.className ?? ""}`}
    />
  );
}

export function UnderlineSelect({
  options,
  placeholder,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: string[];
  placeholder?: string;
}) {
  return (
    <select {...props} className={`${underline} cursor-pointer ${props.className ?? ""}`}>
      <option value="" className="bg-card text-muted">
        {placeholder ?? "Select"}
      </option>
      {options.map((o) => (
        <option key={o} value={o} className="bg-card text-fg">
          {o}
        </option>
      ))}
    </select>
  );
}

export function ProfileSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-display text-base sm:text-lg font-medium tracking-wide text-fg pt-2">
      {children}
    </h3>
  );
}

export function ToggleRow({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-3 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
          checked ? "bg-accent" : "bg-line"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </button>
      <span className="text-sm font-medium text-fg">{label}</span>
    </label>
  );
}

// Chips input for list-of-strings fields (skills, preferred roles…). Enter or
// comma commits; Backspace on an empty draft removes the last chip.
export function TagInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const v = draft.trim();
    if (!v) return;
    if (!values.includes(v)) onChange([...values, v]);
    setDraft("");
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-line focus-within:border-accent py-1.5 transition-colors">
      {values.map((v) => (
        <span
          key={v}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-soft border border-accent/30 text-[11px] font-semibold text-fg"
        >
          {v}
          <button
            type="button"
            onClick={() => onChange(values.filter((x) => x !== v))}
            className="text-muted hover:text-danger transition-colors"
            aria-label={`Remove ${v}`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !draft && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={commit}
        placeholder={values.length ? "" : placeholder}
        className="flex-1 min-w-[140px] bg-transparent py-1 text-sm text-fg placeholder:text-muted/60 focus:outline-none"
      />
    </div>
  );
}
