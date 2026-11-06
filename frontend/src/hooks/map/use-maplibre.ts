import { useEffect, useRef, useState } from "react";
import {
  Map,
  NavigationControl,
  FullscreenControl,
  setWorkerUrl,
  type StyleSpecification,
} from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";

setWorkerUrl(maplibreWorkerUrl);

const OFM_DARK_URL = "https://tiles.openfreemap.org/styles/dark";
const OFM_LIGHT_URL = "https://tiles.openfreemap.org/styles/positron";

let cachedDarkStyle: StyleSpecification | null = null;
let cachedLightStyle: StyleSpecification | null = null;

async function loadThemedStyle(
  isDark: boolean,
): Promise<StyleSpecification | string> {
  if (isDark) {
    if (cachedDarkStyle) return cachedDarkStyle;
    try {
      const res = await fetch(OFM_DARK_URL);
      if (!res.ok) return OFM_DARK_URL;
      const style = (await res.json()) as StyleSpecification;

      // Retheme OpenFreeMap layers to match our deep slate-navy aesthetic
      for (const layer of style.layers) {
        if (layer.id === "background" && "paint" in layer) {
          layer.paint = { ...layer.paint, "background-color": "#0d1527" };
        } else if (layer.id === "water" && "paint" in layer) {
          layer.paint = { ...layer.paint, "fill-color": "#080e1a" };
        } else if (layer.id.includes("boundary") && "paint" in layer) {
          const paint = layer.paint as Record<string, unknown>;
          if (paint && "line-color" in paint) {
            paint["line-color"] = "#23334d";
          }
        }
      }
      cachedDarkStyle = style;
      return style;
    } catch {
      return OFM_DARK_URL;
    }
  } else {
    if (cachedLightStyle) return cachedLightStyle;
    try {
      const res = await fetch(OFM_LIGHT_URL);
      if (!res.ok) return OFM_LIGHT_URL;
      const style = (await res.json()) as StyleSpecification;
      cachedLightStyle = style;
      return style;
    } catch {
      return OFM_LIGHT_URL;
    }
  }
}

interface UseMaplibreOptions {
  initialCenter?: [number, number];
  initialZoom?: number;
}

export function useMaplibre({
  initialCenter = [-98.5795, 39.8283],
  initialZoom = 4,
}: UseMaplibreOptions = {}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let isSubscribed = true;
    const isDarkMode = document.documentElement.classList.contains("dark");

    void loadThemedStyle(isDarkMode).then((style) => {
      if (!isSubscribed || !containerRef.current) return;

      const mapInstance = new Map({
        container: containerRef.current,
        style,
        center: initialCenter,
        zoom: initialZoom,
        attributionControl: {},
      });

      mapInstance.addControl(
        new NavigationControl({ showCompass: true, visualizePitch: true }),
        "top-right",
      );
      mapInstance.addControl(new FullscreenControl(), "top-right");

      mapInstance.on("load", () => {
        mapInstance.resize();
      });

      setMap(mapInstance);

      // Theme toggle observer
      const themeObserver = new MutationObserver(() => {
        const isDark = document.documentElement.classList.contains("dark");
        void loadThemedStyle(isDark).then((newStyle) => {
          mapInstance.setStyle(newStyle);
        });
      });

      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });

      const resizeObserver = new ResizeObserver(() => {
        mapInstance.resize();
      });
      resizeObserver.observe(containerRef.current);
    });

    return () => {
      isSubscribed = false;
      setMap((prev) => {
        if (prev) {
          prev.remove();
        }
        return null;
      });
    };
  }, [initialCenter, initialZoom]);

  return { containerRef, map };
}
