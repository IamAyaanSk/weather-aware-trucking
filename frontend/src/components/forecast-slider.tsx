import { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { formatDistance, formatHourOffset } from "../lib/format";
import type { RouteItem } from "../api/types";
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";

interface ForecastSliderProps {
  currentHour: number;
  maxHours?: number;
  departureTime?: string;
  selectedRoute?: RouteItem | null;
  onHourChange: (hour: number) => void;
  className?: string;
}

function formatOffsetDateTime(departureIso?: string, offsetHours: number = 0): string {
  if (!departureIso) return `+${offsetHours}h`;
  try {
    const date = new Date(departureIso);
    if (isNaN(date.getTime())) return `+${offsetHours}h`;

    const targetDate = new Date(date.getTime() + offsetHours * 3600 * 1000);
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(targetDate);
  } catch {
    return `+${offsetHours}h`;
  }
}

export function ForecastSlider({
  currentHour,
  maxHours = 48,
  departureTime,
  selectedRoute,
  onHourChange,
  className,
}: ForecastSliderProps): React.JSX.Element {
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = useRef<number | null>(null);

  // Playback timer (hourly step every 800ms)
  useEffect(() => {
    if (!isPlaying) {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
      return;
    }

    playIntervalRef.current = window.setInterval(() => {
      onHourChange(currentHour >= maxHours ? 0 : currentHour + 1);
    }, 850);

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    };
  }, [isPlaying, currentHour, maxHours, onHourChange]);

  const handleStepBack = () => {
    setIsPlaying(false);
    onHourChange(Math.max(0, currentHour - 1));
  };

  const handleStepForward = () => {
    setIsPlaying(false);
    onHourChange(Math.min(maxHours, currentHour + 1));
  };

  const handleReset = () => {
    setIsPlaying(false);
    onHourChange(0);
  };

  const progressPercent = maxHours > 0 ? (currentHour / maxHours) * 100 : 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-2xl border border-border/80 bg-card/95 p-2.5 sm:p-3.5 shadow-2xl backdrop-blur-md select-none text-foreground w-[480px] max-w-[calc(100vw-24px)] transition-all",
        className,
      )}
    >
      {/* Top Header Row: Status, Time Readout & Route Info */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <Badge
            variant="outline"
            className="font-mono text-[10px] sm:text-[11px] font-bold bg-secondary/80 text-foreground shrink-0 border-border px-1.5 py-0.5"
          >
            {formatHourOffset(currentHour)}
          </Badge>
          <span className="font-semibold text-foreground truncate text-[11px] sm:text-xs">
            {formatOffsetDateTime(departureTime, currentHour)}
          </span>
        </div>

        {selectedRoute && (
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 text-muted-foreground text-[10px] sm:text-[11px]">
            <span
              className="font-medium text-foreground truncate max-w-[85px] sm:max-w-[160px]"
              title={selectedRoute.name}
            >
              {selectedRoute.name}
            </span>
            <span className="text-muted-foreground/60">•</span>
            <span className="font-mono font-medium">
              {formatDistance(selectedRoute.total_distance_miles)}
            </span>
          </div>
        )}
      </div>

      {/* Main Track Slider */}
      <div className="relative flex items-center w-full my-1">
        <input
          type="range"
          min={0}
          max={maxHours}
          step={1}
          value={currentHour}
          onChange={(e) => {
            setIsPlaying(false);
            onHourChange(parseInt(e.target.value, 10));
          }}
          className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label="Forecast hour slider"
        />
        {/* Visual progress track fill */}
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-2 bg-primary rounded-lg pointer-events-none transition-all duration-75"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Bottom Controls Row: Play/Pause, Steps, & Legend */}
      <div className="flex items-center justify-between gap-3 pt-0.5">
        {/* Playback Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleReset}
            title="Reset to departure (0h)"
            className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleStepBack}
            disabled={currentHour <= 0}
            title="Step backward 1 hour"
            className="size-7 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </Button>

          <Button
            type="button"
            variant="default"
            size="icon"
            onClick={() => setIsPlaying((prev) => !prev)}
            title={isPlaying ? "Pause timeline" : "Play timeline (+1h steps)"}
            className="size-7 rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90"
          >
            {isPlaying ? (
              <Pause className="size-3.5 fill-current" />
            ) : (
              <Play className="size-3.5 fill-current ml-0.5" />
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleStepForward}
            disabled={currentHour >= maxHours}
            title="Step forward 1 hour"
            className="size-7 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        {/* Compact Weather Risk Legend */}
        <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-medium text-muted-foreground shrink-0">
          <span className="hidden md:inline">Risk:</span>
          <div className="flex items-center gap-1 sm:gap-1.5">
            <span className="flex items-center gap-0.5">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span className="hidden sm:inline">Low</span>
            </span>
            <span className="flex items-center gap-0.5">
              <span className="size-2 rounded-full bg-amber-500" />
              <span className="hidden sm:inline">Mod</span>
            </span>
            <span className="flex items-center gap-0.5">
              <span className="size-2 rounded-full bg-orange-500" />
              <span className="hidden sm:inline">High</span>
            </span>
            <span className="flex items-center gap-0.5">
              <span className="size-2 rounded-full bg-red-500" />
              <span className="hidden sm:inline">Sev</span>
            </span>
            <span className="flex items-center gap-0.5">
              <span className="size-2 rounded-full bg-[#991b1b]" />
              <span className="hidden sm:inline">No-Trv</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
