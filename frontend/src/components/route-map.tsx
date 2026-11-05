import { useEffect, useRef } from "react";
import {
  Map,
  NavigationControl,
  setWorkerUrl,
  type StyleSpecification,
} from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { cn } from "cn";

setWorkerUrl(maplibreWorkerUrl);

const OFM_DARK_URL = "https://tiles.openfreemap.org/styles/dark";
const OFM_LIGHT_URL = "https://tiles.openfreemap.org/styles/positron";

// In-memory cache for customized styles
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

interface RouteMapProps {
  className?: string;
  initialCenter?: [number, number]; // [lng, lat]
  initialZoom?: number;
}

export function RouteMap({
  className,
  initialCenter = [-98.5795, 39.8283],
  initialZoom = 4,
}: RouteMapProps): React.JSX.Element {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) {
      return;
    }

    let isSubscribed = true;
    const isDarkMode = document.documentElement.classList.contains("dark");

    void loadThemedStyle(isDarkMode).then((style) => {
      if (!isSubscribed || !mapContainerRef.current) return;

      const map = new Map({
        container: mapContainerRef.current,
        style,
        center: initialCenter,
        zoom: initialZoom,
        attributionControl: {},
      });

      map.addControl(
        new NavigationControl({ showCompass: true }),
        "bottom-right",
      );

      map.on("load", () => {
        map.resize();
      });

      mapInstanceRef.current = map;

      // Theme toggle observer
      const themeObserver = new MutationObserver(() => {
        const isDark = document.documentElement.classList.contains("dark");
        void loadThemedStyle(isDark).then((newStyle) => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setStyle(newStyle);
          }
        });
      });

      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });

      const resizeObserver = new ResizeObserver(() => {
        map.resize();
      });
      resizeObserver.observe(mapContainerRef.current);
    });

    return () => {
      isSubscribed = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [initialCenter, initialZoom]);

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden bg-background",
        className,
      )}
    >
      <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
