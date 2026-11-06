import { useEffect, useMemo, useRef } from "react";
import type { Map, GeoJSONSource } from "maplibre-gl";
import type { CorridorHeatmap } from "../../api/types";
import { precomputeHeatmapFrames } from "../../lib/heatmap-frames";

interface UseHeatmapLayerOptions {
  map: Map | null;
  corridorHeatmap?: CorridorHeatmap | null;
  hour: number; // Integer hour 0..48+
}

export const HEATMAP_SOURCE_ID = "corridor-heatmap-source";
export const HEATMAP_LAYER_ID = "corridor-heatmap-layer";

export function useHeatmapLayer({ map, corridorHeatmap, hour }: UseHeatmapLayerOptions) {
  const { frames } = useMemo(() => precomputeHeatmapFrames(corridorHeatmap), [corridorHeatmap]);
  const prevHourRef = useRef<number>(-1);

  // Setup / teardown heatmap source & layer
  useEffect(() => {
    if (!map) return;

    const setupLayer = () => {
      // Must have valid style loaded in MapLibre before mutating layers
      if (!map.getStyle()) return;

      if (!corridorHeatmap || !corridorHeatmap.points || corridorHeatmap.points.length === 0) {
        if (map.getLayer(HEATMAP_LAYER_ID)) map.removeLayer(HEATMAP_LAYER_ID);
        if (map.getSource(HEATMAP_SOURCE_ID)) map.removeSource(HEATMAP_SOURCE_ID);
        prevHourRef.current = -1;
        return;
      }

      const initialData = frames[hour] ?? {
        type: "FeatureCollection" as const,
        features: [],
      };

      const existingSource = map.getSource(HEATMAP_SOURCE_ID) as GeoJSONSource | undefined;

      if (existingSource) {
        existingSource.setData(initialData);
      } else {
        map.addSource(HEATMAP_SOURCE_ID, {
          type: "geojson",
          data: initialData,
        });

        // Insert below route line casing if it already exists
        const beforeLayerId = map.getLayer("routes-casing") ? "routes-casing" : undefined;

        map.addLayer(
          {
            id: HEATMAP_LAYER_ID,
            type: "heatmap",
            source: HEATMAP_SOURCE_ID,
            paint: {
              // Weight based on calibrated risk score
              "heatmap-weight": ["get", "weight"],

              // Heatmap intensity multiplier across zoom levels:
              // Strong intensity at nationwide zoom so the corridor is immediately visible.
              "heatmap-intensity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                3,
                1.6,
                6,
                2.2,
                9,
                3.0,
                12,
                3.8,
              ],

              // Color ramp mapped strictly to our 5 verified risk levels
              "heatmap-color": [
                "interpolate",
                ["linear"],
                ["heatmap-density"],
                0.0,
                "rgba(0, 0, 0, 0)",
                0.08,
                "rgba(16, 185, 129, 0.45)", // Low / Emerald (soft glow)
                0.28,
                "rgba(16, 185, 129, 0.75)", // Low / Emerald (full)
                0.48,
                "rgba(245, 158, 11, 0.85)", // Moderate / Amber
                0.68,
                "rgba(249, 115, 22, 0.92)", // High / Orange
                0.85,
                "rgba(239, 68, 68, 0.98)", // Severe / Red
                1.0,
                "rgba(153, 27, 27, 1.0)", // No Travel / Dark Crimson
              ],

              // Wide radius of influence so 10-50 mile spaced checkpoints seamlessly blend
              // into an uninterrupted highway weather corridor
              "heatmap-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                3,
                35,
                5,
                55,
                7,
                85,
                9,
                120,
                12,
                170,
              ],

              // Vibrant corridor atmosphere
              "heatmap-opacity": 0.85,
            },
          },
          beforeLayerId,
        );
      }

      // If routes-casing exists, make sure heatmap is positioned underneath it
      if (map.getLayer(HEATMAP_LAYER_ID) && map.getLayer("routes-casing")) {
        map.moveLayer(HEATMAP_LAYER_ID, "routes-casing");
      }

      prevHourRef.current = hour;
    };

    if (map.getStyle()) {
      setupLayer();
    } else {
      map.once("load", setupLayer);
    }
  }, [map, corridorHeatmap, frames, hour]);

  // Update heatmap data on hourly basis
  useEffect(() => {
    if (!map || prevHourRef.current === hour) return;

    const source = map.getSource(HEATMAP_SOURCE_ID) as GeoJSONSource | undefined;
    if (source && frames[hour]) {
      source.setData(frames[hour]);
      prevHourRef.current = hour;
    }
  }, [map, frames, hour]);
}
