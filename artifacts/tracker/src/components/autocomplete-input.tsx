import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface AutocompleteInputProps {
  value: string;
  onChange: (val: string) => void;
  suggestions: string[];
  onSuggestionSelect: (val: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  multiline?: boolean;
}

function highlight(text: string, query: string): { before: string; match: string; after: string } {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return { before: text, match: "", after: "" };
  return {
    before: text.slice(0, idx),
    match: text.slice(idx, idx + query.length),
    after: text.slice(idx + query.length),
  };
}

export function AutocompleteInput({
  value,
  onChange,
  suggestions,
  onSuggestionSelect,
  placeholder,
  className,
  autoFocus,
  onKeyDown,
  multiline = false,
}: AutocompleteInputProps) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const query = value.trim();
  const showDropdown = open && suggestions.length > 0 && query.length > 0;

  useEffect(() => {
    setActiveIndex(-1);
  }, [suggestions]);

  useEffect(() => {
    setOpen(true);
  }, [suggestions]);

  const select = (s: string) => {
    onSuggestionSelect(s);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (showDropdown) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, -1));
        return;
      }
      if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        select(suggestions[activeIndex]);
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
    }
    onKeyDown?.(e);
  };

  const inputProps = {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange(e.target.value);
      setOpen(true);
    },
    placeholder,
    className,
    autoFocus,
    onKeyDown: handleKeyDown,
    onBlur: () => setTimeout(() => setOpen(false), 150),
    onFocus: () => setOpen(true),
  };

  return (
    <div ref={containerRef} className="relative">
      {multiline ? (
        <Textarea
          {...(inputProps as React.ComponentProps<typeof Textarea>)}
          className={cn("min-h-[80px] text-sm resize-none", className)}
        />
      ) : (
        <Input {...(inputProps as React.ComponentProps<typeof Input>)} />
      )}

      {showDropdown && (
        <ul
          className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md text-sm overflow-hidden"
          role="listbox"
        >
          {suggestions.map((s, i) => {
            const { before, match, after } = highlight(s, query);
            return (
              <li
                key={s}
                role="option"
                aria-selected={i === activeIndex}
                className={cn(
                  "flex items-center px-3 py-2 cursor-pointer select-none transition-colors",
                  i === activeIndex
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted/60 text-foreground",
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(s);
                }}
              >
                {before}
                <span className="font-semibold text-primary">{match}</span>
                {after}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
