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
        existingSource.setData(featureCollection as unknown as Parameters<GeoJSONSource["setData"]>[0]);
      } else {
        map.addSource(SOURCE_ID, {
          type: "geojson",
          data: featureCollection as unknown as Parameters<Map["addSource"]>[1] extends { data: infer D } ? D : never,
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
            "line-width": [
              "case",
              ["==", ["get", "id"], selectedRouteId ?? ""],
              8,
              5,
            ],
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
            "line-width": [
              "case",
              ["==", ["get", "id"], selectedRouteId ?? ""],
              5,
              3.5,
            ],
            "line-opacity": [
              "case",
              ["==", ["get", "id"], selectedRouteId ?? ""],
              1,
              0.55,
            ],
          },
        });
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

  // Click on route lines to select
  useEffect(() => {
    if (!map || !routes || routes.length === 0) return;

    const handleLineClick = (e: { features?: MapGeoJSONFeature[] }) => {
      const feature = e.features?.[0];
      if (!feature?.properties) return;
      const id = String(feature.properties.id);
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

    map.on("click", LINE_LAYER_ID, handleLineClick);
    map.on("mouseenter", LINE_LAYER_ID, handleMouseEnter);
    map.on("mouseleave", LINE_LAYER_ID, handleMouseLeave);

    return () => {
      map.off("click", LINE_LAYER_ID, handleLineClick);
      map.off("mouseenter", LINE_LAYER_ID, handleMouseEnter);
      map.off("mouseleave", LINE_LAYER_ID, handleMouseLeave);
    };
  }, [map, routes, onSelectRoute]);

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
