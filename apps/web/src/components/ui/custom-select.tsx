"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "@/components/animated-icons";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export interface CustomSelectOption {
  value: string;
  label: string;
  symbol?: string;
  description?: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  disabled?: boolean;
  align?: "left" | "right";
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className,
  buttonClassName,
  menuClassName,
  disabled = false,
  align = "left",
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

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

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className={cn(
          "w-full h-11 px-3.5 rounded-xl border border-line bg-surface/60 text-fg text-xs sm:text-sm font-medium",
          "flex items-center justify-between gap-2 text-left cursor-pointer transition-all",
          "hover:border-line-strong hover:bg-surface/90 focus:border-accent focus:bg-card focus:outline-none",
          isOpen && "border-accent bg-card ring-1 ring-accent/20",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none",
          buttonClassName
        )}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedOption ? (
            <span className="truncate">{selectedOption.label}</span>
          ) : (
            <span className="text-muted/60 truncate">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted shrink-0 transition-transform duration-200",
            isOpen && "rotate-180 text-fg"
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
              "border border-line bg-card/95 backdrop-blur-md p-1 shadow-2xl",
              "no-scrollbar scrollbar-none",
              align === "right" ? "right-0" : "left-0",
              menuClassName
            )}
          >
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
