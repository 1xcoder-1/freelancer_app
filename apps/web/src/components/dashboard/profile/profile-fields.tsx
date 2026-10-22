"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { X, ChevronDown, Check, Plus, Code2 } from "@/components/animated-icons";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { TechIcon } from "./tech-icon";

export const TechLogo = TechIcon;
export { TechIcon };

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
  placeholder = "Select...",
  value,
  onChange,
  disabled,
  className = "",
}: {
  options: Array<string | { value: string; label: string }>;
  placeholder?: string;
  value?: string | number | readonly string[];
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const stringValue = String(value ?? "");
  const normalizedOptions = useMemo(
    () =>
      options.map((o) =>
        typeof o === "string" ? { value: o, label: o } : o
      ),
    [options]
  );

  const selectedOption = normalizedOptions.find((opt) => opt.value === stringValue);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (val: string) => {
    setIsOpen(false);
    if (onChange) {
      const syntheticEvent = {
        target: { value: val },
        currentTarget: { value: val },
      } as React.ChangeEvent<HTMLSelectElement>;
      onChange(syntheticEvent);
    }
  };

  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isOpen) setSearch("");
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return normalizedOptions;
    const q = search.trim().toLowerCase();
    return normalizedOptions.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [normalizedOptions, search]);

  const hasExactSearchMatch = normalizedOptions.some(
    (o) =>
      o.label.toLowerCase() === search.trim().toLowerCase() ||
      o.value.toLowerCase() === search.trim().toLowerCase()
  );

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className={cn(
          "w-full bg-transparent border-0 border-b border-line py-2 text-sm text-left transition-colors",
          "flex items-center justify-between gap-2 cursor-pointer focus:outline-none focus:border-accent",
          isOpen && "border-accent",
          disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "hover:border-line-strong"
        )}
      >
        <span className={cn("truncate", selectedOption ? "text-fg font-medium" : "text-muted/60")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-muted shrink-0 transition-transform duration-200",
            isOpen && "rotate-180 text-accent"
          )}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={cn(
              "absolute top-full mt-1.5 z-50 min-w-full max-h-64 overflow-y-auto rounded-xl",
              "border border-line bg-card/95 backdrop-blur-md p-1.5 shadow-2xl",
              "scrollbar-thin scrollbar-thumb-line-strong scrollbar-track-transparent"
            )}
          >
            {normalizedOptions.length > 6 && (
              <div className="p-1 mb-1 border-b border-line/40 sticky top-0 bg-card/95 backdrop-blur-md z-10">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter or type custom..."
                  className="w-full bg-surface/60 border border-line rounded-lg px-2.5 py-1 text-xs text-fg placeholder:text-muted/60 focus:outline-none focus:border-accent"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
            {filteredOptions.map((option) => {
              const isSelected = option.value === stringValue;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "w-full px-3 py-2 rounded-lg text-xs sm:text-sm font-medium text-left transition-all",
                    "flex items-center justify-between gap-2 cursor-pointer",
                    isSelected
                      ? "bg-accent/10 text-accent font-semibold"
                      : "text-fg hover:bg-surface/80 hover:text-fg"
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-accent shrink-0" />
                  )}
                </button>
              );
            })}
            {search.trim() && !hasExactSearchMatch && (
              <button
                type="button"
                onClick={() => handleSelect(search.trim())}
                className="w-full px-3 py-2 rounded-lg text-xs font-medium text-accent hover:bg-accent/10 transition-all flex items-center justify-between gap-2 cursor-pointer text-left border-t border-line/40 mt-1"
              >
                <span className="truncate">Set as: "{search.trim()}"</span>
                <Plus className="w-3.5 h-3.5 shrink-0" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
  withLogos = false,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  withLogos?: boolean;
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
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-fg shadow-xs transition-colors",
            withLogos
              ? "rounded-lg bg-surface/80 border border-line hover:border-line-strong"
              : "rounded-full bg-accent-soft border border-accent/30 text-[11px] font-semibold"
          )}
        >
          {withLogos && <TechIcon name={v} className="w-3.5 h-3.5 shrink-0" />}
          <span>{v}</span>
          <button
            type="button"
            onClick={() => onChange(values.filter((x) => x !== v))}
            className="text-muted/60 hover:!text-danger transition-colors p-0.5"
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
