import { useState } from "react";
import { Button } from "#components/ui/button";
import { Input } from "#components/ui/input";
import { Separator } from "#components/ui/separator";
import { Badge } from "#components/ui/badge";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "#components/ui/accordion";
import { LocationAutocompleteInput } from "./location-autocomplete-input";
import type { LocationCoordinate, RouteItem } from "../api/types";
import { formatDistance, formatDuration, formatSpeed } from "../lib/format";
import { ArrowUpDown, HazeIcon, Loader2, Map, Pencil } from "lucide-react";
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
  routes?: RouteItem[];
  selectedRouteId?: string | null;
  onSelectRoute?: (routeId: string) => void;
  isEditingForm?: boolean;
  onToggleEditing?: (isEditing: boolean) => void;
  error?: Error | null;
  onCloseMobile?: () => void;
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
  routes,
  selectedRouteId,
  onSelectRoute,
  isEditingForm: isEditingProp,
  onToggleEditing,
  error = null,
  onCloseMobile,
}: RoutePlannerPanelProps): React.JSX.Element {
  const [loadWeightInput, setLoadWeightInput] = useState<string>("35000");
  const [departureTime, setDepartureTime] = useState<string>(() =>
    formatLocalDateTime(new Date()),
  );
  const [internalEditingForm, setInternalEditingForm] = useState(false);

  const isEditingForm =
    isEditingProp !== undefined ? isEditingProp : internalEditingForm;
  const setIsEditingForm = onToggleEditing ?? setInternalEditingForm;

  const hasRoutes = Boolean(routes && routes.length > 0);

  const handleSwapLocations = () => {
    if (isPending) return;
    const tempOrigin = origin;
    onOriginChange(destination);
    onDestinationChange(tempOrigin);
  };

  const handleSetNow = () => {
    if (isPending) return;
    setDepartureTime(formatLocalDateTime(new Date()));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin || !destination || isPending) {
      return;
    }
    setIsEditingForm(false);
    const parsedLoadWeight =
      loadWeightInput.trim() === ""
        ? 0
        : Math.max(0, parseInt(loadWeightInput, 10) || 0);

    onPlanRoute?.({
      origin,
      destination,
      loadWeightLbs: parsedLoadWeight,
      departureTime,
    });
  };

  const [openAccordionIds, setOpenAccordionIds] = useState<string[]>(() =>
    routes ? routes.map((r) => r.id) : [],
  );
  const [prevRoutes, setPrevRoutes] = useState<RouteItem[] | undefined>(routes);

  if (routes !== prevRoutes) {
    setPrevRoutes(routes);
    setOpenAccordionIds(routes ? routes.map((r) => r.id) : []);
  }

  return (
    <aside
      className={cn(
        "flex h-full w-screen sm:w-[380px] max-w-full sm:max-w-[380px] flex-col border-r border-border/80 bg-card/95 backdrop-blur-md rounded-none sm:rounded-tr-2xl sm:rounded-br-2xl shadow-2xl overflow-hidden shrink-0",
        className,
      )}
    >
      {/* Top Header */}
      <div className="border-b border-border/70 px-4 sm:px-5 py-3.5 sm:py-4 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-foreground">
            Weather aware route planning
          </h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Corridor analysis & risk assessment
          </p>
        </div>
        {onCloseMobile && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCloseMobile}
            className="md:hidden flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground h-8 px-2.5 rounded-lg border border-border/60 bg-background/50 cursor-pointer"
          >
            <Map className="size-3.5" />
            <span>Map</span>
          </Button>
        )}
      </div>

      {/* Main Content (Scrollable) */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Once we have routes and not in edit mode: Show the same Origin & Dest UI using readonly inputs */}
        {hasRoutes && !isEditingForm ? (
          <div className="space-y-4">
            {/* Same UI structure as before: Left indicator track, 2 inputs, and right button */}
            <div className="relative flex items-center gap-3">
              {/* Left Indicator Track */}
              <div className="flex flex-col items-center justify-between self-stretch py-2 w-4 shrink-0">
                <div className="size-3.5 rounded-full border-2 border-foreground/80 bg-background shrink-0" />
                <div className="flex flex-col items-center gap-0.5 my-1">
                  <div className="size-1 rounded-full bg-muted-foreground/60" />
                  <div className="size-1 rounded-full bg-muted-foreground/60" />
                  <div className="size-1 rounded-full bg-muted-foreground/60" />
                </div>
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

              {/* Readonly Inputs Column */}
              <div className="flex-1 space-y-2.5 min-w-0">
                <div>
                  <label htmlFor="readonly-origin-input" className="sr-only">
                    Origin
                  </label>
                  <Input
                    id="readonly-origin-input"
                    readOnly
                    value={origin?.name || ""}
                    title={origin?.name}
                    className="h-10 text-sm bg-background/50 border-input rounded-lg truncate cursor-default select-none focus-visible:ring-0"
                  />
                </div>

                <div>
                  <label
                    htmlFor="readonly-destination-input"
                    className="sr-only"
                  >
                    Destination
                  </label>
                  <Input
                    id="readonly-destination-input"
                    readOnly
                    value={destination?.name || ""}
                    title={destination?.name}
                    className="h-10 text-sm bg-background/50 border-input rounded-lg truncate cursor-default select-none focus-visible:ring-0"
                  />
                </div>
              </div>

              {/* Edit button close to inputs to toggle editable form */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsEditingForm(true)}
                title="Edit origin and destination"
                className="size-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 shrink-0 cursor-pointer"
              >
                <Pencil className="size-4" />
                <span className="sr-only">Edit route inputs</span>
              </Button>
            </div>

            <Separator className="bg-border/60" />

            {/* Routes Accordion List */}
            <div className="space-y-2 pt-4">
              <span className="font-semibold text-foreground tracking-tight px-0.5 block">
                Available Routes ({routes?.length})
              </span>

              <Accordion
                multiple
                value={openAccordionIds}
                onValueChange={(val) => {
                  const newIds = Array.isArray(val) ? val : [val];
                  setOpenAccordionIds(newIds.filter(Boolean));
                }}
              >
                {routes?.map((route, index) => {
                  const isSelected = route.id === selectedRouteId;

                  return (
                    <AccordionItem
                      key={route.id}
                      value={route.id}
                      className="transition-colors border-b-0! bg-muted/70 py-2 mb-3 rounded-xl"
                    >
                      <AccordionTrigger
                        onClick={() => onSelectRoute?.(route.id)}
                        className={cn(
                          "hover:no-underline transition-colors text-left w-full px-4 py-3 rounded-none",
                          isSelected && "text-foreground font-semibold",
                        )}
                      >
                        <div className="flex flex-col gap-1 min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-foreground truncate">
                              {route.name || `Route ${index + 1}`}
                            </span>
                          </div>

                          {/* Small Total Miles and Hours */}
                          <span className="text-xs font-bold text-muted-foreground">
                            {formatDistance(route.total_distance_miles)} •{" "}
                            {formatDuration(route.total_duration_hours)}
                          </span>

                          <div className="flex items-center gap-1.5 flex-wrap mt-1">
                            {route.is_recommended && (
                              <Badge className="text-xs" variant="default">
                                Recommended
                              </Badge>
                            )}
                            {/* {hasNoTravel && (
                              <Badge
                                className="text-[11px] bg-rose-950/80 text-rose-300 border-rose-800"
                                variant="destructive"
                              >
                                No Travel
                              </Badge>
                            )}
                            {!hasNoTravel && hasSevere && (
                              <Badge
                                className="text-[11px] bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30"
                                variant="outline"
                              >
                                Severe Risk
                              </Badge>
                            )} */}
                          </div>
                        </div>
                      </AccordionTrigger>

                      <AccordionContent className="pb-3 text-xs border-t border-t-primary-foreground/10 pt-2 px-4">
                        <div className="flex flex-col gap-5 pt-2">
                          {/* Metrics Summary Grid */}

                          <div>
                            <h4 className="text-sm font-bold mb-3 flex items-center gap-1">
                              <Map size={16} />
                              <span>Route summary</span>
                            </h4>
                            <ul className="flex flex-row justify-between gap-2 flex-wrap">
                              <li className="flex gap-2.5">
                                <span className="text-muted-foreground font-medium">
                                  Total trip distance:
                                </span>{" "}
                                <span className="font-bold">
                                  {formatDistance(route.total_distance_miles)}
                                </span>
                              </li>
                              <li className="flex gap-2.5">
                                <span className="text-muted-foreground font-medium">
                                  Total trip duration:
                                </span>{" "}
                                <span className="font-bold">
                                  {formatDuration(route.total_duration_hours)}
                                </span>
                              </li>
                              <li className="flex gap-2.5">
                                <span className="text-muted-foreground font-medium">
                                  Recommended avg speed:
                                </span>{" "}
                                <span className="font-bold">
                                  {formatSpeed(route.avg_speed_mph)}
                                </span>
                              </li>
                            </ul>
                          </div>

                          <div>
                            <h4 className="text-sm font-bold mb-3 flex items-center gap-1">
                              <HazeIcon size={16} />
                              <span>Risk assessment</span>
                            </h4>

                            <ul className="flex flex-row justify-between gap-3.5 flex-wrap">
                              <li className="flex gap-1.5 text-green-300/80">
                                <span>Low:</span>{" "}
                                <span>
                                  {formatDistance(route.metrics.low_miles)}
                                </span>
                              </li>
                              <li className="flex gap-1.5 text-yellow-300/80">
                                <span>Moderate:</span>{" "}
                                <span>
                                  {formatDistance(route.metrics.moderate_miles)}
                                </span>
                              </li>
                              <li className="flex gap-1.5 text-orange-300/80">
                                <span>High:</span>{" "}
                                <span>
                                  {formatDistance(route.metrics.high_miles)}
                                </span>
                              </li>
                              <li className="flex gap-1.5 text-red-300/80">
                                <span>Severe:</span>{" "}
                                <span>
                                  {formatDistance(route.metrics.severe_miles)}
                                </span>
                              </li>
                              <li className="flex gap-1.5 text-amber-600/80">
                                <span>No-Travel:</span>{" "}
                                <span>
                                  {formatDistance(
                                    route.metrics.no_travel_miles,
                                  )}
                                </span>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
          </div>
        ) : (
          /* Editable Form (Shown before routes exist, or when user clicks Edit) */
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Origin & Destination Inputs with left track and swap button */}
            <div className="relative flex items-center gap-3">
              {/* Left Indicator Track */}
              <div className="flex flex-col items-center justify-between self-stretch py-2 w-4 shrink-0">
                <div className="size-3.5 rounded-full border-2 border-foreground/80 bg-background shrink-0" />
                <div className="flex flex-col items-center gap-0.5 my-1">
                  <div className="size-1 rounded-full bg-muted-foreground/60" />
                  <div className="size-1 rounded-full bg-muted-foreground/60" />
                  <div className="size-1 rounded-full bg-muted-foreground/60" />
                </div>
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

              {/* Inputs Column */}
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
                    disabled={isPending}
                    iconType="origin"
                    isPickingOnMap={pickingTarget === "origin"}
                    onTogglePickOnMap={
                      onTogglePickOnMap
                        ? () => onTogglePickOnMap("origin")
                        : undefined
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
                    disabled={isPending}
                    iconType="destination"
                    isPickingOnMap={pickingTarget === "destination"}
                    onTogglePickOnMap={
                      onTogglePickOnMap
                        ? () => onTogglePickOnMap("destination")
                        : undefined
                    }
                  />
                </div>
              </div>

              {/* Swap Button Column */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={isPending || !origin || !destination}
                onClick={handleSwapLocations}
                title="Swap origin and destination"
                className="size-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ArrowUpDown className="size-4" />
                <span className="sr-only">Swap origin and destination</span>
              </Button>
            </div>

            <Separator className="bg-border/60" />

            {/* Cargo Load Weight Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="cargo-weight-input"
                className="text-xs font-medium text-foreground block"
              >
                Cargo load weight
              </label>
              <div className="relative">
                <Input
                  id="cargo-weight-input"
                  type="number"
                  min={0}
                  max={80000}
                  step={1}
                  placeholder="0"
                  value={loadWeightInput}
                  disabled={isPending}
                  onChange={(e) => setLoadWeightInput(e.target.value)}
                  className="h-10 pr-12 text-sm bg-background/70 border-input rounded-lg focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                  lbs
                </span>
              </div>
            </div>

            {/* Departure Time Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="departure-time-input"
                  className="text-xs font-medium text-foreground"
                >
                  Departure time
                </label>
                <button
                  type="button"
                  onClick={handleSetNow}
                  disabled={isPending}
                  className="text-[11px] text-primary hover:underline font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Set to Now
                </button>
              </div>
              <Input
                id="departure-time-input"
                type="datetime-local"
                value={departureTime}
                disabled={isPending}
                onChange={(e) => setDepartureTime(e.target.value)}
                className="h-10 text-sm bg-background/70 border-input rounded-lg focus-visible:ring-1 focus-visible:ring-primary [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-85 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Error Feedback */}
            {error && !isPending && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-2.5">
                {error.message ||
                  "Could not retrieve route plan. Please check inputs and retry."}
              </p>
            )}

            {/* Submit Action */}
            <div className="pt-1 flex items-center gap-2">
              <Button
                type="submit"
                disabled={!origin || !destination || isPending}
                className="flex-1 h-10 text-sm font-semibold rounded-lg shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Planning route...
                  </span>
                ) : hasRoutes ? (
                  "Update route plan"
                ) : (
                  "Get route plan"
                )}
              </Button>

              {hasRoutes && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => setIsEditingForm(false)}
                  className="h-10 text-sm px-3 cursor-pointer"
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        )}
      </div>

      {/* Bottom Section: Route Insights Card (Shown before routes plan) */}
      {!hasRoutes && !isPending && (
        <div className="p-4 mt-auto shrink-0 hidden sm:block">
          <div className="relative h-38 overflow-hidden rounded-sm bg-background/60 p-4 shadow-xs">
            <div className="relative z-10 space-y-1 pr-24">
              <h3 className="text-sm font-medium text-foreground">
                Route insights
              </h3>
              <p className="text-xs text-muted-foreground/70">
                Plan your route simply by getting each analysis on the optimal
                route and predict how your journey would be.
              </p>
            </div>

            <img
              src="/assets/truck.svg"
              alt="Truck"
              className="absolute right-0 -bottom-1 w-40 h-auto pointer-events-none opacity-85 object-contain"
            />
          </div>
        </div>
      )}

      {/* Bottom Section: Route Alternatives Card (Shown both when viewing routes and during editing mode) */}
      {hasRoutes && (
        <div className="p-4 mt-auto shrink-0 hidden sm:block">
          <div className="relative h-38 overflow-hidden rounded-sm bg-background/60 p-4 shadow-xs">
            <div className="relative z-10 space-y-1 pr-24">
              <h3 className="text-sm font-medium text-foreground">
                Route alternatives
              </h3>
              <p className="text-xs text-muted-foreground/70 leading-relaxed">
                Up to 3 commercial truck corridors are evaluated and mapped.
                Available alternatives may vary based on highway network
                infrastructure and vehicle clearance limits.
              </p>
            </div>

            <img
              src="/assets/truck.svg"
              alt="Truck"
              className="absolute right-0 -bottom-1 w-40 h-auto pointer-events-none opacity-85 object-contain"
            />
          </div>
        </div>
      )}
    </aside>
  );
}
