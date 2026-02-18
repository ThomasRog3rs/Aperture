"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type SearchableDropdownProps = {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  allLabel: string;
  className?: string;
};

export function SearchableDropdown({
  options,
  value,
  onChange,
  placeholder,
  allLabel,
  className = "",
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    return options.filter((option) =>
      option.toLowerCase().includes(lowerSearch)
    );
  }, [options, search]);

  const handleSelect = (option: string) => {
    onChange(option);
    setIsOpen(false);
    setSearch("");
  };

  const currentLabel = value || allLabel;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground transition-colors hover:border-border-hover 2xl:py-2 2xl:text-base"
      >
        <span className="truncate">{currentLabel}</span>
        <ChevronDown
          className={`h-4 w-4 text-muted transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full z-50 mt-2 flex max-h-80 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
          >
            <div className="sticky top-0 border-b border-border bg-surface p-2">
              <div className="relative flex items-center">
                <Search className="absolute left-3 h-4 w-4 text-faint" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={placeholder}
                  className="w-full rounded-lg bg-background/50 py-2 pl-9 pr-8 text-sm outline-none placeholder:text-faint focus:ring-1 focus:ring-accent/30"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2 text-faint hover:text-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-1">
              <button
                onClick={() => handleSelect("")}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent/10 ${
                  !value ? "bg-accent/5 text-accent" : "text-foreground"
                }`}
              >
                <span>{allLabel}</span>
                {!value && <Check className="h-4 w-4" />}
              </button>

              {filteredOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => handleSelect(option)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent/10 ${
                    value === option
                      ? "bg-accent/5 text-accent"
                      : "text-foreground"
                  }`}
                >
                  <span className="truncate">{option}</span>
                  {value === option && <Check className="h-4 w-4" />}
                </button>
              ))}

              {filteredOptions.length === 0 && search && (
                <div className="px-3 py-8 text-center text-sm text-faint">
                  No results found
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
