import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "cn";

interface RiskLegendProps {
  className?: string;
  defaultCollapsed?: boolean;
}

const RISK_TIERS = [
  {
    level: "LOW",
    label: "Low",
    color: "#10b981", // emerald-500
    description: "Wind < 25 mph, Rain < 0.10 in/hr, Snow < 0.5 in/hr",
  },
  {
    level: "MODERATE",
    label: "Moderate",
    color: "#f59e0b", // amber-500
    description: "Wind 25-34 mph, Rain 0.10-0.25 in/hr, Snow 0.5-1.0 in/hr",
  },
  {
    level: "HIGH",
    label: "High",
    color: "#f97316", // orange-500
    description: "Wind 35-44 mph, Rain 0.25-0.50 in/hr, Snow 1.0-2.0 in/hr",
  },
  {
    level: "SEVERE",
    label: "Severe",
    color: "#ef4444", // red-500
    description: "Wind 45-54 mph, Rain 0.50-1.00 in/hr, Snow 2.0-3.0 in/hr",
  },
  {
    level: "NO_TRAVEL",
    label: "No Travel",
    color: "#991b1b", // dark red-800
    description:
      "Wind ≥ 55 mph, Rain > 1.0 in/hr, Snow > 3.0 in/hr, or Wind+Load",
  },
] as const;

export function RiskLegend({
  className,
  defaultCollapsed = false,
}: RiskLegendProps): React.JSX.Element {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <div
      className={cn(
        "rounded-lg border border-border/80 bg-card/95 p-3 shadow-lg backdrop-blur-md select-none text-foreground transition-all duration-150 min-w-[130px]",
        className,
      )}
    >
      {/* Legend Title */}
      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-border/50">
        <span className="text-[12px] font-bold text-foreground tracking-tight">
          Weather Risk
        </span>
        <button
          type="button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors cursor-pointer"
          title={isCollapsed ? "Expand legend" : "Collapse legend"}
          aria-label={isCollapsed ? "Expand legend" : "Collapse legend"}
        >
          {isCollapsed ? (
            <ChevronUp className="size-3" />
          ) : (
            <ChevronDown className="size-3" />
          )}
        </button>
      </div>

      {/* Vertical Items List (like classic GIS / map legends) */}
      {!isCollapsed ? (
        <div className="flex flex-col gap-1.5 pt-2">
          {RISK_TIERS.map((tier) => (
            <div
              key={tier.level}
              className="flex items-center gap-2 group cursor-help"
              title={`${tier.label}: ${tier.description}`}
            >
              <span
                className="size-3.5 shrink-0 rounded-[2px] shadow-xs"
                style={{ backgroundColor: tier.color }}
              />
              <span className="text-[12px] font-medium text-foreground/90 group-hover:text-foreground transition-colors leading-none">
                {tier.label}
              </span>
            </div>
          ))}
        </div>
      ) : (
        /* Collapsed mini indicator row */
        <div className="flex items-center gap-1 pt-1.5">
          {RISK_TIERS.map((tier) => (
            <span
              key={tier.level}
              className="size-2 rounded-xs"
              style={{ backgroundColor: tier.color }}
              title={tier.label}
            />
          ))}
        </div>
      )}
    </div>
  );
}
