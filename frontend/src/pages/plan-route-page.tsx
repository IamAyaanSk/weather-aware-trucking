import { useState } from "react";
import { RoutePlannerPanel } from "../components/route-planner-panel";
import { RouteMap } from "../components/route-map";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";

export function PlanRoutePage(): React.JSX.Element {
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 h-full w-full">
        <RouteMap />
      </div>

      <div
        className={cn(
          "absolute top-0 bottom-0 left-0 z-20 transition-transform duration-300 ease-in-out",
          isPanelCollapsed ? "-translate-x-full" : "translate-x-0",
        )}
      >
        <RoutePlannerPanel />

        <button
          type="button"
          onClick={() => setIsPanelCollapsed((prev) => !prev)}
          className="absolute -right-5 top-1/2 -translate-y-1/2 z-30 flex h-14 w-5 items-center justify-center rounded-r-lg border-y border-r border-border/80 bg-card/95 text-muted-foreground shadow-md backdrop-blur-md transition-colors hover:bg-card hover:text-foreground cursor-pointer select-none"
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
