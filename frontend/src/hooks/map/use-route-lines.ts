import { useEffect } from "react";
import { LngLatBounds, type Map, type GeoJSONSource, type MapGeoJSONFeature } from "maplibre-gl";
import { decodePolyline } from "../../lib/polyline";
import type { RouteItem } from "../../api/types";

interface UseRouteLinesOptions {
  map: Map | null;
  routes?: RouteItem[];
  selectedRouteId?: string | null;
  onSelectRoute?: (routeId: string) => void;
}

const SOURCE_ID = "routes-source";
const CASING_LAYER_ID = "routes-casing";
const LINE_LAYER_ID = "routes-line";
const HIT_TARGET_LAYER_ID = "routes-hit-target";

interface RouteFeature {
  type: "Feature";
  id?: string | number;
  properties: {
    id: string;
    name: string;
    isSelected: boolean;
    isRecommended: boolean;
  };
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
}

interface RouteFeatureCollection {
  type: "FeatureCollection";
  features: RouteFeature[];
}

export function useRouteLines({
  map,
  routes,
  selectedRouteId,
  onSelectRoute,
}: UseRouteLinesOptions) {
  // Update GeoJSON source & layers
  useEffect(() => {
    if (!map) return;

    const setupLayers = () => {
      if (!routes || routes.length === 0) {
        if (map.getLayer(HIT_TARGET_LAYER_ID)) map.removeLayer(HIT_TARGET_LAYER_ID);
        if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
        if (map.getLayer(CASING_LAYER_ID)) map.removeLayer(CASING_LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
        return;
      }

      // GeoJSON Features
      const features: RouteFeature[] = routes.map((route) => ({
        type: "Feature",
        id: route.id,
        properties: {
          id: route.id,
          name: route.name,
          isSelected: route.id === selectedRouteId,
          isRecommended: route.is_recommended,
        },
        geometry: {
          type: "LineString",
          coordinates: decodePolyline(route.overview_polyline),
        },
      }));

      // Order features so selected route is drawn on top
      features.sort((a, b) => {
        if (a.properties?.id === selectedRouteId) return 1;
        if (b.properties?.id === selectedRouteId) return -1;
        return 0;
      });

      const featureCollection: RouteFeatureCollection = {
        type: "FeatureCollection",
        features,
      };

      const existingSource = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;

      if (existingSource) {
        existingSource.setData(
          featureCollection as unknown as Parameters<GeoJSONSource["setData"]>[0],
        );
      } else {
        map.addSource(SOURCE_ID, {
          type: "geojson",
          data: featureCollection as unknown as Parameters<Map["addSource"]>[1] extends {
            data: infer D;
          }
            ? D
            : never,
        });

        // Dark casing for outline contrast
        map.addLayer({
          id: CASING_LAYER_ID,
          type: "line",
          source: SOURCE_ID,
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#020617",
            "line-width": ["case", ["==", ["get", "id"], selectedRouteId ?? ""], 8, 5],
            "line-opacity": 0.7,
          },
        });

        // Main colored line layer
        map.addLayer({
          id: LINE_LAYER_ID,
          type: "line",
          source: SOURCE_ID,
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": [
              "case",
              ["==", ["get", "id"], selectedRouteId ?? ""],
              "#3b82f6",
              "#64748b",
            ],
            "line-width": ["case", ["==", ["get", "id"], selectedRouteId ?? ""], 5, 3.5],
            "line-opacity": ["case", ["==", ["get", "id"], selectedRouteId ?? ""], 1, 0.55],
          },
        });

        // Invisible wide hit target for easy clicking and hover switching
        map.addLayer({
          id: HIT_TARGET_LAYER_ID,
          type: "line",
          source: SOURCE_ID,
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#000000",
            "line-width": 26, // Generous 26px clickable corridor
            "line-opacity": 0.001, // Invisible visually, but fully responsive to pointer and clicks
          },
        });
      }

      // Ensure hit target layer stays on top of route line
      if (map.getLayer(HIT_TARGET_LAYER_ID)) {
        map.moveLayer(HIT_TARGET_LAYER_ID);
      }

      // Update paint properties on layer if already exists
      if (map.getLayer(CASING_LAYER_ID)) {
        map.setPaintProperty(CASING_LAYER_ID, "line-width", [
          "case",
          ["==", ["get", "id"], selectedRouteId ?? ""],
          8,
          5,
        ]);
      }

      if (map.getLayer(LINE_LAYER_ID)) {
        map.setPaintProperty(LINE_LAYER_ID, "line-color", [
          "case",
          ["==", ["get", "id"], selectedRouteId ?? ""],
          "#3b82f6",
          "#64748b",
        ]);
        map.setPaintProperty(LINE_LAYER_ID, "line-width", [
          "case",
          ["==", ["get", "id"], selectedRouteId ?? ""],
          5,
          3.5,
        ]);
        map.setPaintProperty(LINE_LAYER_ID, "line-opacity", [
          "case",
          ["==", ["get", "id"], selectedRouteId ?? ""],
          1,
          0.55,
        ]);
      }
    };

    if (map.isStyleLoaded()) {
      setupLayers();
    } else {
      map.once("style.load", setupLayers);
    }
  }, [map, routes, selectedRouteId]);

  // Click on route lines to select (via wide hit-target layer)
  useEffect(() => {
    if (!map || !routes || routes.length === 0) return;

    const handleLineClick = (e: { features?: MapGeoJSONFeature[] }) => {
      if (!e.features || e.features.length === 0) return;
      // If click hit multiple overlapping routes, prefer switching to the alternative route
      const alternativeFeature = e.features.find(
        (f) => String(f.properties?.id) !== selectedRouteId,
      );
      const chosenFeature = alternativeFeature ?? e.features[0];
      const id = String(chosenFeature.properties?.id);
      if (id && onSelectRoute) {
        onSelectRoute(id);
      }
    };

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    map.on("click", HIT_TARGET_LAYER_ID, handleLineClick);
    map.on("mouseenter", HIT_TARGET_LAYER_ID, handleMouseEnter);
    map.on("mouseleave", HIT_TARGET_LAYER_ID, handleMouseLeave);

    return () => {
      map.off("click", HIT_TARGET_LAYER_ID, handleLineClick);
      map.off("mouseenter", HIT_TARGET_LAYER_ID, handleMouseEnter);
      map.off("mouseleave", HIT_TARGET_LAYER_ID, handleMouseLeave);
    };
  }, [map, routes, selectedRouteId, onSelectRoute]);

  // Fit camera bounds across all routes when routes load or change
  useEffect(() => {
    if (!map || !routes || routes.length === 0) return;

    const bounds = new LngLatBounds();
    let hasCoords = false;

    routes.forEach((route) => {
      const coords = decodePolyline(route.overview_polyline);
      coords.forEach(([lng, lat]) => {
        bounds.extend([lng, lat]);
        hasCoords = true;
      });
    });

    if (!hasCoords) return;

    map.fitBounds(bounds, {
      padding: { top: 80, bottom: 80, left: 420, right: 80 },
      maxZoom: 14,
      duration: 1200,
    });
  }, [map, routes]);
}
