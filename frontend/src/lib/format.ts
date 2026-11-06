export function formatDistance(miles: number): string {
  if (miles < 10) {
    return `${miles.toFixed(1)} mi`;
  }
  return `${Math.round(miles).toLocaleString()} mi`;
}

export function formatDuration(totalHours: number): string {
  if (totalHours <= 0) return "0m";

  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);

  if (hours === 0) {
    return `${minutes}m`;
  }
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}m`;
}

export function formatSpeed(mph: number): string {
  return `${Math.round(mph)} mph`;
}

export function formatEta(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;

    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch {
    return isoString;
  }
}

export function formatHourOffset(offset: number): string {
  if (offset <= 0) return "Departure";
  return `+${offset}h`;
}

export function formatCoordinate(lat: number, lng: number): string {
  const latStr = `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"}`;
  const lngStr = `${Math.abs(lng).toFixed(4)}°${lng >= 0 ? "E" : "W"}`;
  return `${latStr}, ${lngStr}`;
}

export function formatPrecipitation(inches: number): string {
  if (inches === 0) return "0 in/hr";
  if (inches < 0.01) return "<0.01 in/hr";
  return `${inches.toFixed(2)} in/hr`;
}

export function formatTemperature(degF: number): string {
  return `${Math.round(degF)}°F`;
}
