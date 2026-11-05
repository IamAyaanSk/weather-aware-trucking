import { useState } from "react";
import { Button } from "#components/ui/button";
import { Input } from "#components/ui/input";
import { Separator } from "#components/ui/separator";
import { LocationAutocompleteInput } from "./location-autocomplete-input";
import type { LocationCoordinate } from "../api/types";
import { ArrowUpDown } from "lucide-react";
import { cn } from "cn";

interface RoutePlannerPanelProps {
  className?: string;
  origin: LocationCoordinate | null;
  destination: LocationCoordinate | null;
  onOriginChange: (location: LocationCoordinate | null) => void;
  onDestinationChange: (location: LocationCoordinate | null) => void;
  pickingTarget?: "origin" | "destination" | null;
  onTogglePickOnMap?: (target: "origin" | "destination") => void;
  onPlanRoute?: (params: {
    origin: LocationCoordinate;
    destination: LocationCoordinate;
    loadWeightLbs: number;
    departureTime: string;
  }) => void;
  isPending?: boolean;
}

function formatLocalDateTime(date: Date): string {
  const pad = (num: number) => String(num).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function RoutePlannerPanel({
  className,
  origin,
  destination,
  onOriginChange,
  onDestinationChange,
  pickingTarget = null,
  onTogglePickOnMap,
  onPlanRoute,
  isPending = false,
}: RoutePlannerPanelProps): React.JSX.Element {
  const [loadWeightLbs, setLoadWeightLbs] = useState<number>(35000);
  const [departureTime, setDepartureTime] = useState<string>(() => formatLocalDateTime(new Date()));

  const handleSwapLocations = () => {
    const tempOrigin = origin;
    onOriginChange(destination);
    onDestinationChange(tempOrigin);
  };

  const handleSetNow = () => {
    setDepartureTime(formatLocalDateTime(new Date()));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin || !destination) {
      return;
    }
    onPlanRoute?.({
      origin,
      destination,
      loadWeightLbs,
      departureTime,
    });
  };

  return (
    <aside
      className={cn(
        "flex h-full w-[380px] flex-col border-r border-border/80 bg-card/95 backdrop-blur-md rounded-tr-2xl rounded-br-2xl shadow-2xl overflow-hidden shrink-0",
        className,
      )}
    >
      {/* Top Header */}
      <div className="border-b border-border/70 px-5 py-4">
        <h1 className="text-sm font-semibold tracking-tight text-foreground">
          Weather aware route planning
        </h1>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Corridor analysis & risk assessment
        </p>
      </div>

      {/* Main Form Section (Scrollable) */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Origin & Destination Section */}
          <div className="relative flex items-center gap-3">
            {/* Left Indicator Track */}
            <div className="flex flex-col items-center justify-between self-stretch py-2 w-4 shrink-0">
              {/* Origin Hollow Ring */}
              <div className="size-3.5 rounded-full border-2 border-foreground/80 bg-background shrink-0" />
              {/* 3 Connecting Dots */}
              <div className="flex flex-col items-center gap-0.5 my-1">
                <div className="size-1 rounded-full bg-muted-foreground/60" />
                <div className="size-1 rounded-full bg-muted-foreground/60" />
                <div className="size-1 rounded-full bg-muted-foreground/60" />
              </div>
              {/* Destination Red Pin */}
              <svg
                viewBox="0 0 24 24"
                className="size-4 text-destructive shrink-0"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
                <circle cx="12" cy="9" r="2.2" fill="var(--color-card)" />
              </svg>
            </div>

            {/* Inputs Column with Photon Autocomplete */}
            <div className="flex-1 space-y-2.5 min-w-0">
              <div>
                <label htmlFor="origin-input" className="sr-only">
                  Origin
                </label>
                <LocationAutocompleteInput
                  id="origin-input"
                  placeholder="Choose starting point..."
                  value={origin}
                  onChange={onOriginChange}
                  iconType="origin"
                  isPickingOnMap={pickingTarget === "origin"}
                  onTogglePickOnMap={
                    onTogglePickOnMap ? () => onTogglePickOnMap("origin") : undefined
                  }
                />
              </div>

              <div>
                <label htmlFor="destination-input" className="sr-only">
                  Destination
                </label>
                <LocationAutocompleteInput
                  id="destination-input"
                  placeholder="Choose destination..."
                  value={destination}
                  onChange={onDestinationChange}
                  iconType="destination"
                  isPickingOnMap={pickingTarget === "destination"}
                  onTogglePickOnMap={
                    onTogglePickOnMap ? () => onTogglePickOnMap("destination") : undefined
                  }
                />
              </div>
            </div>

            {/* Swap Button Column */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleSwapLocations}
              title="Swap origin and destination"
              className="size-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 shrink-0"
            >
              <ArrowUpDown className="size-4" />
              <span className="sr-only">Swap origin and destination</span>
            </Button>
          </div>

          <Separator className="bg-border/60" />

          {/* Cargo Load Weight Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="cargo-weight-input" className="text-xs font-medium text-foreground">
                Cargo load weight
              </label>
            </div>
            <div className="relative">
              <Input
                id="cargo-weight-input"
                type="number"
                min={0}
                max={80000}
                step={500}
                value={loadWeightLbs}
                onChange={(e) => setLoadWeightLbs(Math.max(0, Number(e.target.value) || 0))}
                className="h-10 pr-12 text-sm bg-background/70 border-input rounded-lg focus-visible:ring-1 focus-visible:ring-primary"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                lbs
              </span>
            </div>
          </div>

          {/* Departure Time Field - White calendar indicator */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="departure-time-input" className="text-xs font-medium text-foreground">
                Departure time
              </label>
              <button
                type="button"
                onClick={handleSetNow}
                className="text-[11px] text-primary hover:underline font-medium transition-colors cursor-pointer"
              >
                Set to Now
              </button>
            </div>
            <Input
              id="departure-time-input"
              type="datetime-local"
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
              className="h-10 text-sm bg-background/70 border-input rounded-lg focus-visible:ring-1 focus-visible:ring-primary [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-85 hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
            />
          </div>

          {/* Submit Action */}
          <div className="pt-1">
            <Button
              type="submit"
              disabled={!origin || !destination || isPending}
              className="w-full h-10 text-sm font-semibold rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isPending ? "Getting route plan..." : "Get route plan"}
            </Button>
          </div>
        </form>
      </div>

      {/* Bottom Section: Route Insights Card */}
      <div className="p-4 mt-auto shrink-0">
        <div className="relative h-38 overflow-hidden rounded-sm bg-background/60 p-4 shadow-xs">
          <div className="relative z-10 space-y-1 pr-24">
            <h3 className="text-sm font-medium text-foreground">Route insights</h3>
            <p className="text-xs text-muted-foreground/70">
              Plan your route simply by getting each analysis on the optimal route and predict how
              your journey would be.
            </p>
          </div>

          {/* Truck artwork placed on bottom-right */}
          <img
            src="/assets/truck.svg"
            alt="Truck"
            className="absolute right-0 -bottom-1 w-40 h-auto pointer-events-none opacity-85 object-contain"
          />
        </div>
      </div>
    </aside>
  );
}
