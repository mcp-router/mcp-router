import React, { useState, useEffect, useCallback, useRef } from "react";
import { IconSearch, IconX } from "@tabler/icons-react";
import { Input, Button } from "@mcp_router/ui";
import { cn } from "@/renderer/utils/tailwind-utils";

export interface MarketplaceSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  categories?: string[];
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;
}

const DEBOUNCE_DELAY = 300;

export const MarketplaceSearch: React.FC<MarketplaceSearchProps> = ({
  value,
  onChange,
  placeholder = "Search...",
  categories,
  selectedCategory,
  onCategoryChange,
}) => {
  const [internalValue, setInternalValue] = useState(value);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);

  // Sync internal value when external value changes
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // Debounced onChange callback
  useEffect(() => {
    // Skip debounce on first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Clear previous timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new debounced timeout
    debounceTimeoutRef.current = setTimeout(() => {
      if (internalValue !== value) {
        onChange(internalValue);
      }
    }, DEBOUNCE_DELAY);

    // Cleanup on unmount or value change
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [internalValue, onChange, value]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInternalValue(e.target.value);
    },
    [],
  );

  const handleClear = useCallback(() => {
    setInternalValue("");
    onChange("");
  }, [onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape" && internalValue) {
        e.preventDefault();
        handleClear();
      }
    },
    [internalValue, handleClear],
  );

  const handleCategoryClick = useCallback(
    (category: string) => {
      if (onCategoryChange) {
        onCategoryChange(category);
      }
    },
    [onCategoryChange],
  );

  const hasContent = internalValue.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Search Input */}
      <div className="relative flex-1">
        <IconSearch
          className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
          aria-hidden="true"
        />
        <Input
          type="text"
          value={internalValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "pl-10 rounded-full bg-muted/30 border-none focus-visible:ring-primary/20 focus-visible:bg-muted/50 transition-all",
            hasContent && "pr-10",
          )}
          aria-label={placeholder}
        />
        {hasContent && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
            aria-label="Clear search"
          >
            <IconX className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Category Filter Buttons */}
      {categories && categories.length > 0 && onCategoryChange && (
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Filter by category"
        >
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => handleCategoryClick(category)}
              aria-pressed={selectedCategory === category}
            >
              {category}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MarketplaceSearch;
