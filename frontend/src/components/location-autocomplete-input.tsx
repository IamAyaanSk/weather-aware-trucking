import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "#components/ui/input";
import { searchPhotonLocations, type LocationSearchResult } from "../api/photon";
import type { LocationCoordinate } from "../api/types";
import { MapPin, Loader2, X, Crosshair } from "lucide-react";
import { cn } from "cn";

interface LocationAutocompleteInputProps {
  id: string;
  placeholder: string;
  value: LocationCoordinate | null;
  onChange: (location: LocationCoordinate | null) => void;
  className?: string;
  disabled?: boolean;
  isPickingOnMap?: boolean;
  onTogglePickOnMap?: () => void;
  iconType?: "origin" | "destination";
}

export function LocationAutocompleteInput({
  id,
  placeholder,
  value,
  onChange,
  className,
  disabled = false,
  isPickingOnMap = false,
  onTogglePickOnMap,
}: LocationAutocompleteInputProps): React.JSX.Element {
  // TODO: We can use react hook forms in v2 for less manual states managemrnt
  const [inputValue, setInputValue] = useState(value?.name ?? "");
  const [prevValue, setPrevValue] = useState<LocationCoordinate | null>(value);
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync internal text when external value changes without cascading effect renders
  if (value !== prevValue) {
    setPrevValue(value);
    setInputValue(value?.name ?? "");
  }

  // Handle outside click to dismiss dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Debounced search when input value changes
  useEffect(() => {
    if (!isOpen) return;

    const trimmed = inputValue.trim();
    // If the input exactly matches the selected location name or is too short, don't trigger search
    if ((value && trimmed === value.name) || trimmed.length < 2) {
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timer = setTimeout(() => {
      setIsLoading(true);
      searchPhotonLocations(trimmed, controller.signal)
        .then((items) => {
          setResults(items);
          setHasSearched(true);
          setActiveIndex(-1);
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setResults([]);
          setHasSearched(true);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }, 280);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [inputValue, isOpen, value]);

  const handleSelect = useCallback(
    (item: LocationSearchResult) => {
      const displayName = item.subtitle ? `${item.name}, ${item.subtitle}` : item.name;
      setInputValue(displayName);
      setIsOpen(false);
      setResults([]);
      setHasSearched(false);
      onChange({
        name: displayName,
        lat: item.lat,
        lng: item.lng,
      });
    },
    [onChange],
  );

  const handleClear = () => {
    setInputValue("");
    setResults([]);
    setHasSearched(false);
    setIsOpen(false);
    onChange(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) {
      if (e.key === "ArrowDown" && inputValue.trim().length >= 2) {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < results.length) {
        handleSelect(results[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const showDropdown =
    isOpen && inputValue.trim().length >= 2 && (!value || inputValue.trim() !== value.name);

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative flex items-center">
        <Input
          id={id}
          value={inputValue}
          onChange={(e) => {
            const val = e.target.value;
            setInputValue(val);
            setIsOpen(true);
            if (val.trim().length < 2) {
              setResults([]);
              setHasSearched(false);
              setIsLoading(false);
            }
            if (!val.trim() && value) {
              onChange(null);
            }
          }}
          onFocus={() => {
            if (!disabled && inputValue.trim().length >= 2) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={isPickingOnMap ? "Click on map to choose location..." : placeholder}
          autoComplete="off"
          className={cn(
            "h-10 text-sm bg-background/70 border-input rounded-lg placeholder:text-muted-foreground/70 focus-visible:ring-1 focus-visible:ring-primary pr-14 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
            isPickingOnMap && "ring-1 ring-primary border-primary bg-primary/5",
          )}
        />

        {/* Action icons on right (no spinner here; the autocomplete box displays it) */}
        <div className="absolute right-1.5 flex items-center gap-0.5">
          {!disabled && inputValue && (
            <button
              type="button"
              onClick={handleClear}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground/80 hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
              title="Clear location"
              aria-label="Clear location"
            >
              <X className="size-3.5" />
            </button>
          )}

          {onTogglePickOnMap && (
            <button
              type="button"
              onClick={onTogglePickOnMap}
              disabled={disabled}
              className={cn(
                "flex size-6 items-center justify-center rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
                isPickingOnMap
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/60",
              )}
              title={
                isPickingOnMap
                  ? "Click on map to drop pin (Active)"
                  : "Pick location directly on map"
              }
              aria-label="Pick location on map"
            >
              <Crosshair className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Autocomplete Dropdown - Compact & Professional */}
      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-52 overflow-y-auto rounded-xs border border-border/80 bg-card/98 backdrop-blur-md shadow-lg p-1 animate-in fade-in-50 duration-100">
          {isLoading ? (
            <div className="flex items-center gap-2 px-2.5 py-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />
              <span>Searching locations...</span>
            </div>
          ) : results.length > 0 ? (
            <>
              <div className="px-2 py-0.5 text-[9px] font-semibold tracking-wider uppercase text-muted-foreground/60 border-b border-border/40 mb-0.5">
                Locations via Photon
              </div>
              <ul role="listbox" className="space-y-0.5">
                {results.map((item, index) => {
                  const isSelected = activeIndex === index;
                  return (
                    <li
                      key={item.id}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={cn(
                        "flex items-start gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors text-left text-xs",
                        isSelected
                          ? "bg-primary/15 text-foreground"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      )}
                    >
                      <MapPin className="size-3.5 shrink-0 mt-0.5 text-white" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground text-xs leading-snug truncate">
                          {item.name}
                        </p>
                        {item.subtitle && (
                          <p className="text-[10px] text-muted-foreground/80 leading-snug truncate">
                            {item.subtitle}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : hasSearched ? (
            <div className="px-2.5 py-2 text-xs text-muted-foreground text-center">
              No locations found
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
