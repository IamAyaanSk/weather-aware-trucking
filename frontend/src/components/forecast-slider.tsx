import { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";

interface ForecastSliderProps {
  currentHour: number;
  maxHours?: number;
  departureTime?: string;
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
      month: "short",
      day: "numeric",
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
  onHourChange,
  className,
}: ForecastSliderProps): React.JSX.Element {
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = useRef<number | null>(null);

  // Playback timer (hourly step every 850ms)
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
  const midHour = Math.round(maxHours / 2);

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-2xl border border-border/70 bg-card/90 px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-2xl backdrop-blur-xl select-none text-foreground w-[360px] sm:w-[410px] max-w-[calc(100vw-24px)] transition-all",
        className,
      )}
    >
      {/* Top Row: Playback Controls & Prominent Hour Display */}
      <div className="flex items-center justify-between gap-3">
        {/* Playback Controls (Unfilled buttons) */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleReset}
            disabled={currentHour === 0}
            title="Reset to departure (0h)"
            className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 disabled:opacity-25 cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleStepBack}
            disabled={currentHour <= 0}
            title="Step back 1 hour"
            className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 disabled:opacity-25 cursor-pointer"
          >
            <ChevronLeft className="size-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setIsPlaying((prev) => !prev)}
            title={isPlaying ? "Pause timeline" : "Play corridor forecast"}
            className="size-7 sm:size-8 rounded-md text-foreground hover:text-primary hover:bg-muted/80 transition-transform active:scale-95 cursor-pointer"
          >
            {isPlaying ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4 ml-0.5" />
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleStepForward}
            disabled={currentHour >= maxHours}
            title="Step forward 1 hour"
            className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 disabled:opacity-25 cursor-pointer"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        {/* Prominent Hour Value & Date Readout (No badge, prominent bold typography) */}
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-mono text-base sm:text-lg font-bold tracking-tight text-foreground select-none">
            {currentHour === 0 ? "0h" : `+${currentHour}h`}
          </span>
          <span className="text-xs font-medium text-muted-foreground truncate">
            {formatOffsetDateTime(departureTime, currentHour)}
          </span>
        </div>
      </div>

      {/* Bottom Row: Scrubber Track with Range Markers */}
      <div className="flex flex-col gap-1">
        <div className="relative flex items-center w-full">
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
            className="w-full h-1.5 bg-secondary/80 rounded-full appearance-none cursor-pointer accent-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label="Forecast hour slider"
          />
          {/* Visual progress fill */}
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 bg-primary rounded-full pointer-events-none transition-all duration-75"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Timeline markers */}
        <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground/70 px-0.5 font-mono">
          <span>0h</span>
          <span>+{midHour}h</span>
          <span>+{maxHours}h</span>
        </div>
      </div>
    </div>
  );
}
