import type { CorridorHeatmap } from "../api/types";

export interface HeatmapFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
  properties: {
    weight: number;
  };
}

export interface HeatmapFeatureCollection {
  type: "FeatureCollection";
  features: HeatmapFeature[];
}

export interface PrecomputedHeatmap {
  frames: Record<number, HeatmapFeatureCollection>;
  maxHours: number;
}

export function precomputeHeatmapFrames(
  corridorHeatmap?: CorridorHeatmap | null,
): PrecomputedHeatmap {
  if (
    !corridorHeatmap ||
    !corridorHeatmap.points ||
    corridorHeatmap.points.length === 0
  ) {
    return { frames: {}, maxHours: 48 };
  }

  const { points, hourly_intensity } = corridorHeatmap;
  const hourKeys = Object.keys(hourly_intensity)
    .map((k) => parseInt(k, 10))
    .filter((n) => !isNaN(n));
  const maxHours = hourKeys.length > 0 ? Math.max(48, ...hourKeys) : 48;

  const frames: Record<number, HeatmapFeatureCollection> = {};

  for (let h = 0; h <= maxHours; h++) {
    const intensities = hourly_intensity[String(h)] ?? [];

    const features: HeatmapFeature[] = [];
    for (let i = 0; i < points.length; i++) {
      const [lat, lng] = points[i];
      const intensity = intensities[i] ?? 0;

      const calibratedWeight =
        intensity > 0 ? Math.min(1, 0.22 + intensity * 0.78) : 0.18;

      features.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [lng, lat],
        },
        properties: {
          weight: calibratedWeight,
        },
      });
    }

    frames[h] = {
      type: "FeatureCollection",
      features,
    };
  }

  return { frames, maxHours };
}
