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
