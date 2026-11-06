import type { Checkpoint } from "../api/types";
import { getRiskConfig, getRuleTriggeredDetails } from "../lib/risk";
import {
  formatCoordinate,
  formatDistance,
  formatEta,
  formatHourOffset,
  formatPrecipitation,
  formatTemperature,
} from "../lib/format";
import { Separator } from "./ui/separator";
import { X } from "lucide-react";
import { cn } from "cn";

interface CheckpointCardProps {
  checkpoint: Checkpoint;
  totalCheckpoints?: number;
  className?: string;
  onClose?: () => void;
  onClick?: () => void;
}

export function CheckpointCard({
  checkpoint,
  className,
  onClose,
  onClick,
}: CheckpointCardProps): React.JSX.Element {
  const weather = checkpoint.arrival_weather;
  const risk = getRiskConfig(weather?.risk_level);
  const ruleDetails = weather?.rule_triggered
    ? getRuleTriggeredDetails(weather.rule_triggered)
    : null;

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative w-[320px] rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl backdrop-blur-md overflow-hidden text-left font-sans select-none p-4 space-y-4",
        onClick && "cursor-pointer",
        className,
      )}
    >
      {/* Floating Close Button */}
      {onClose && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 cursor-pointer transition-colors"
          title="Close"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      )}

      {/* Section 1: Checkpoint summary */}
      <div>
        <h4 className="text-sm font-bold mb-2.5 text-foreground">
          Checkpoint summary
        </h4>
        <ul className="flex flex-col gap-2 text-xs">
          <li className="flex justify-between gap-2">
            <span className="text-muted-foreground font-medium">
              Mile marker:
            </span>
            <span className="font-bold">
              {formatDistance(checkpoint.mile_marker)}
            </span>
          </li>
          <li className="flex justify-between gap-2">
            <span className="text-muted-foreground font-medium">
              Estimated arrival:
            </span>
            <span className="font-bold">{formatEta(checkpoint.eta_iso)}</span>
          </li>
          <li className="flex justify-between gap-2">
            <span className="text-muted-foreground font-medium">
              Trip time elapsed:
            </span>
            <span className="font-bold">
              {formatHourOffset(checkpoint.arrival_hour_offset)}
            </span>
          </li>
          <li className="flex justify-between gap-2">
            <span className="text-muted-foreground font-medium">
              Coordinates:
            </span>
            <span className="font-bold font-mono text-[11px]">
              {formatCoordinate(checkpoint.lat, checkpoint.lng)}
            </span>
          </li>
        </ul>
      </div>

      <Separator className="bg-border/60" />

      {/* Section 2: Weather conditions at arrival */}
      <div>
        <h4 className="text-sm font-bold mb-2.5 text-foreground">
          Weather conditions at arrival
        </h4>
        {weather ? (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <li className="flex justify-between gap-1">
              <span className="text-muted-foreground font-medium">Temp:</span>
              <span className="font-bold">
                {formatTemperature(weather.temperature_f)}
              </span>
            </li>
            <li className="flex justify-between gap-1">
              <span className="text-muted-foreground font-medium">Wind:</span>
              <span className="font-bold">
                {weather.wind_mph.toFixed(1)} mph
              </span>
            </li>
            <li className="flex justify-between gap-1">
              <span className="text-muted-foreground font-medium">Rain:</span>
              <span className="font-bold">
                {formatPrecipitation(weather.rain_in_hr)}
              </span>
            </li>
            <li className="flex justify-between gap-1">
              <span className="text-muted-foreground font-medium">Snow:</span>
              <span className="font-bold">
                {weather.snow_in_hr > 0
                  ? `${weather.snow_in_hr.toFixed(1)} in/hr`
                  : "0 in/hr"}
              </span>
            </li>
          </ul>
        ) : (
          <p className="text-muted-foreground italic text-xs">
            Weather data unavailable
          </p>
        )}
      </div>

      <Separator className="bg-border/60" />

      <div>
        <h4 className="text-sm font-bold mb-2.5 text-foreground">
          Risk assessment
        </h4>

        {ruleDetails && (
          <div className="mb-2.5 p-2.5 text-xs">
            <div className="flex items-center gap-1.5 font-semibold">
              <span>{ruleDetails.title}</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              {ruleDetails.explanation}
            </p>
          </div>
        )}

        <ul className="flex flex-row justify-between gap-2 flex-wrap text-xs">
          <li className={cn("flex gap-1.5", risk.textClass)}>
            <span className="text-muted-foreground font-medium">
              Risk level:
            </span>
            <span className="font-bold">{risk.label}</span>
          </li>
          <li className="flex gap-1.5">
            <span className="text-muted-foreground font-medium">Score:</span>
            <span className="font-bold">
              {weather ? `${weather.risk_score} / 4` : "N/A"}
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
