import type { Checkpoint } from "../api/types";
import { getRiskConfig, getRuleTriggeredDetails } from "./risk";
import {
  formatCoordinate,
  formatDistance,
  formatEta,
  formatHourOffset,
  formatPrecipitation,
  formatTemperature,
} from "./format";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function createCheckpointPopupHtml(
  checkpoint: Checkpoint,
  _totalCheckpoints?: number,
): string {
  const weather = checkpoint.arrival_weather;
  const risk = getRiskConfig(weather?.risk_level);
  const ruleDetails = weather?.rule_triggered
    ? getRuleTriggeredDetails(weather.rule_triggered)
    : null;

  const etaText = formatEta(checkpoint.eta_iso);
  const offsetText = formatHourOffset(checkpoint.arrival_hour_offset);
  const coordsText = formatCoordinate(checkpoint.lat, checkpoint.lng);
  const mileText = formatDistance(checkpoint.mile_marker);

  const alertIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-amber-500"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  const closeIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

  return `
    <div class="spotter-checkpoint-card relative w-[320px] rounded-2xl border border-border/80 bg-card/95 text-card-foreground shadow-2xl backdrop-blur-md overflow-hidden text-left font-sans select-none p-4 space-y-4 pointer-events-auto">
      <!-- Floating Close Button -->
      <button
        type="button"
        class="checkpoint-popup-close-btn absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 cursor-pointer transition-colors"
        title="Close"
        aria-label="Close"
      >
        ${closeIcon}
      </button>

      <!-- Section 1: Checkpoint summary (no icon in heading) -->
      <div>
        <h4 class="text-sm font-bold mb-2.5 text-foreground">
          Checkpoint summary
        </h4>
        <ul class="flex flex-col gap-2 text-xs">
          <li class="flex justify-between gap-2">
            <span class="text-muted-foreground font-medium">Mile marker:</span>
            <span class="font-bold text-foreground">${escapeHtml(mileText)}</span>
          </li>
          <li class="flex justify-between gap-2">
            <span class="text-muted-foreground font-medium">Estimated arrival:</span>
            <span class="font-bold text-foreground">${escapeHtml(etaText)}</span>
          </li>
          <li class="flex justify-between gap-2">
            <span class="text-muted-foreground font-medium">Trip time elapsed:</span>
            <span class="font-bold text-foreground">${escapeHtml(offsetText)}</span>
          </li>
          <li class="flex justify-between gap-2">
            <span class="text-muted-foreground font-medium">Coordinates:</span>
            <span class="font-bold font-mono text-[11px] text-foreground">${escapeHtml(coordsText)}</span>
          </li>
        </ul>
      </div>

      <div class="h-px bg-border/60 -mx-4"></div>

      <!-- Section 2: Weather conditions at arrival (no icon in heading) -->
      <div>
        <h4 class="text-sm font-bold mb-2.5 text-foreground">
          Weather conditions at arrival
        </h4>
        ${
          weather
            ? `
          <ul class="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <li class="flex justify-between gap-1">
              <span class="text-muted-foreground font-medium">Temp:</span>
              <span class="font-bold text-foreground">${formatTemperature(weather.temperature_f)}</span>
            </li>
            <li class="flex justify-between gap-1">
              <span class="text-muted-foreground font-medium">Wind:</span>
              <span class="font-bold text-foreground">${weather.wind_mph.toFixed(1)} mph</span>
            </li>
            <li class="flex justify-between gap-1">
              <span class="text-muted-foreground font-medium">Rain:</span>
              <span class="font-bold text-foreground">${formatPrecipitation(weather.rain_in_hr)}</span>
            </li>
            <li class="flex justify-between gap-1">
              <span class="text-muted-foreground font-medium">Snow:</span>
              <span class="font-bold text-foreground">${weather.snow_in_hr > 0 ? `${weather.snow_in_hr.toFixed(1)} in/hr` : "0 in/hr"}</span>
            </li>
          </ul>
        `
            : `
          <p class="text-muted-foreground italic text-xs">Weather data unavailable</p>
        `
        }
      </div>

      <div class="h-px bg-border/60 -mx-4"></div>

      <!-- Section 3: Risk assessment (no icon in heading) -->
      <div>
        <h4 class="text-sm font-bold mb-2.5 text-foreground">
          Risk assessment
        </h4>

        ${
          ruleDetails
            ? `
          <div class="mb-2.5 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs">
            <div class="flex items-center gap-1.5 font-semibold text-amber-500 dark:text-amber-400">
              ${alertIcon}
              <span>${escapeHtml(ruleDetails.title)}</span>
            </div>
            <p class="text-[11px] text-muted-foreground mt-0.5 leading-snug">${escapeHtml(ruleDetails.explanation)}</p>
          </div>
        `
            : ""
        }

        <ul class="flex flex-row justify-between gap-2 flex-wrap text-xs">
          <li class="flex gap-1.5 ${risk.textClass}">
            <span class="text-muted-foreground font-medium">Risk level:</span>
            <span class="font-bold">${escapeHtml(risk.label)}</span>
          </li>
          <li class="flex gap-1.5">
            <span class="text-muted-foreground font-medium">Score:</span>
            <span class="font-bold text-foreground">${weather ? `${weather.risk_score} / 4` : "N/A"}</span>
          </li>
        </ul>
      </div>
    </div>
  `;
}
