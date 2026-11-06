import { useState } from "react";
import { RoutePlannerPanel } from "../components/route-planner-panel";
import { RouteMap } from "../components/route-map";
import { ForecastSlider } from "../components/forecast-slider";
import { useRoutePlanQuery } from "../hooks/queries/use-route-plan-query";
import { useIsMobile } from "../hooks/use-mobile";
import type { LocationCoordinate, PlanRouteRequest } from "../api/types";
import { ChevronLeft, ChevronRight, PanelLeft } from "lucide-react";
import { cn } from "cn";

export function PlanRoutePage(): React.JSX.Element {
  const isMobile = useIsMobile();
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [origin, setOrigin] = useState<LocationCoordinate | null>(null);
  const [destination, setDestination] = useState<LocationCoordinate | null>(
    null,
  );
  const [pickingTarget, setPickingTarget] = useState<
    "origin" | "destination" | null
  >(null);
  const [routeRequest, setRouteRequest] = useState<PlanRouteRequest | null>(
    null,
  );
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [isEditingForm, setIsEditingForm] = useState(false);
  const [forecastHour, setForecastHour] = useState<number>(0);

  const routePlanQuery = useRoutePlanQuery(routeRequest);

  const routes = routePlanQuery.data?.routes;
  const corridorHeatmap = routePlanQuery.data?.corridor_heatmap;
  const hasRoutes = Boolean(routes && routes.length > 0);
  const isEditing = !hasRoutes || isEditingForm;

  const activeRouteId =
    selectedRouteId && routes?.some((r) => r.id === selectedRouteId)
      ? selectedRouteId
      : (routePlanQuery.data?.recommended_route_id ?? routes?.[0]?.id ?? null);

  const activeRoute =
    routes?.find((r) => r.id === activeRouteId) ?? routes?.[0] ?? null;

  const maxForecastHours = corridorHeatmap?.hourly_intensity
    ? Math.max(
        48,
        ...Object.keys(corridorHeatmap.hourly_intensity)
          .map((k) => parseInt(k, 10))
          .filter((n) => !isNaN(n)),
      )
    : 48;

  const handleTogglePickOnMap = (target: "origin" | "destination") => {
    setPickingTarget((prev) => {
      const next = prev === target ? null : target;
      if (next && isMobile) {
        setIsPanelCollapsed(true);
      }
      return next;
    });
  };

  const handlePickLocation = (
    target: "origin" | "destination",
    location: LocationCoordinate,
  ) => {
    if (target === "origin") {
      setOrigin(location);
    } else {
      setDestination(location);
    }
    setPickingTarget(null);
    if (isMobile) {
      setIsPanelCollapsed(false);
    }
  };

  const handleCancelPick = () => {
    setPickingTarget(null);
    if (isMobile) {
      setIsPanelCollapsed(false);
    }
  };

  const handlePlanRoute = (params: {
    origin: LocationCoordinate;
    destination: LocationCoordinate;
    loadWeightLbs: number;
    departureTime: string;
  }) => {
    setIsEditingForm(false);
    setForecastHour(0);
    if (isMobile) {
      setIsPanelCollapsed(true);
    }
    const inputDate = new Date(params.departureTime);
    const now = new Date();

    const effectiveDate = inputDate < now ? now : inputDate;
    const departureIso = effectiveDate.toISOString();
    setRouteRequest({
      origin: params.origin,
      destination: params.destination,
      departure_time: departureIso,
      load_weight_lbs: params.loadWeightLbs,
    });
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 h-full w-full">
        <RouteMap
          origin={origin}
          destination={destination}
          onOriginChange={setOrigin}
          onDestinationChange={setDestination}
          pickingTarget={pickingTarget}
          onPickLocation={handlePickLocation}
          onCancelPick={handleCancelPick}
          isPlanning={routePlanQuery.isFetching}
          routes={routes}
          selectedRouteId={activeRouteId}
          onSelectRoute={setSelectedRouteId}
          isEditing={isEditing}
          corridorHeatmap={corridorHeatmap}
          forecastHour={forecastHour}
        />
      </div>

      {/* Floating button on map when panel is collapsed */}
      {isPanelCollapsed && (
        <button
          type="button"
          onClick={() => setIsPanelCollapsed(false)}
          className="absolute top-4 left-4 z-30 flex items-center gap-2 rounded-full border border-border/80 bg-card/95 px-3.5 py-2 text-xs font-semibold text-foreground shadow-xl backdrop-blur-md transition-all hover:bg-card hover:scale-105 active:scale-95 cursor-pointer"
        >
          <PanelLeft className="size-4 text-primary" />
          <span>{hasRoutes ? `Routes (${routes?.length ?? 0})` : "Plan Route"}</span>
        </button>
      )}

      {/* Forecast Slider (Visible when routes exist; on mobile, only when panel is collapsed) */}
      {hasRoutes && (!isMobile || isPanelCollapsed) && (
        <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
          <ForecastSlider
            currentHour={forecastHour}
            maxHours={maxForecastHours}
            departureTime={routeRequest?.departure_time}
            selectedRoute={activeRoute}
            onHourChange={setForecastHour}
          />
        </div>
      )}

      {/* Side Planning & Results Panel */}
      <div
        className={cn(
          "absolute top-0 bottom-0 left-0 z-30 transition-transform duration-300 ease-in-out",
          isPanelCollapsed ? "-translate-x-full" : "translate-x-0",
        )}
      >
        <RoutePlannerPanel
          origin={origin}
          destination={destination}
          onOriginChange={setOrigin}
          onDestinationChange={setDestination}
          pickingTarget={pickingTarget}
          onTogglePickOnMap={handleTogglePickOnMap}
          onPlanRoute={handlePlanRoute}
          isPending={routePlanQuery.isFetching}
          routes={routes}
          selectedRouteId={activeRouteId}
          onSelectRoute={setSelectedRouteId}
          isEditingForm={isEditingForm}
          onToggleEditing={setIsEditingForm}
          error={routePlanQuery.error}
          onCloseMobile={() => setIsPanelCollapsed(true)}
        />

        {/* Desktop Side Toggle Button */}
        <button
          type="button"
          onClick={() => setIsPanelCollapsed((prev) => !prev)}
          className="hidden md:flex absolute -right-5 top-1/2 -translate-y-1/2 z-30 h-14 w-5 items-center justify-center rounded-r-lg border-y border-r border-border/80 bg-card/95 text-muted-foreground shadow-md backdrop-blur-md transition-colors hover:bg-card hover:text-foreground cursor-pointer select-none"
          title={
            isPanelCollapsed
              ? "Expand route planning panel"
              : "Collapse route planning panel"
          }
          aria-label={
            isPanelCollapsed
              ? "Expand route planning panel"
              : "Collapse route planning panel"
          }
        >
          {isPanelCollapsed ? (
            <ChevronRight className="size-3.5" />
          ) : (
            <ChevronLeft className="size-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
