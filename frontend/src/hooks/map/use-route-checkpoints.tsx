import { useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Marker, Popup, type Map } from "maplibre-gl";
import type { Checkpoint } from "../../api/types";
import { getRiskConfig } from "../../lib/risk";
import { CheckpointCard } from "../../components/checkpoint-card";

interface UseRouteCheckpointsOptions {
  map: Map | null;
  checkpoints?: Checkpoint[];
  routeId?: string | null;
  onSelectCheckpoint?: (checkpoint: Checkpoint) => void;
}

export function useRouteCheckpoints({
  map,
  checkpoints,
  routeId,
  onSelectCheckpoint,
}: UseRouteCheckpointsOptions) {
  const [activeCheckpoint, setActiveCheckpoint] = useState<Checkpoint | null>(null);
  const popupContainer = useMemo(() => document.createElement("div"), []);
  const markersRef = useRef<Marker[]>([]);
  const activeMarkerElRef = useRef<HTMLElement | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const onSelectCheckpointRef = useRef(onSelectCheckpoint);

  useEffect(() => {
    onSelectCheckpointRef.current = onSelectCheckpoint;
  });

  // Setup single reusable Popup instance hosting the React portal container
  useEffect(() => {
    const popup = new Popup({
      closeButton: false,
      closeOnClick: false,
      offset: [0, -16],
      className: "checkpoint-popup",
    });

    popup.setDOMContent(popupContainer);
    popupRef.current = popup;

    return () => {
      popup.remove();
      popupRef.current = null;
    };
  }, [popupContainer]);

  // Synchronize Checkpoint Markers with active route
  useEffect(() => {
    if (!map) return;

    // Helper to clear existing markers and popup
    const clearMarkers = () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (popupRef.current) {
        popupRef.current.remove();
      }
      setActiveCheckpoint(null);
      if (activeMarkerElRef.current) {
        activeMarkerElRef.current.classList.remove("is-active");
        activeMarkerElRef.current = null;
      }
    };

    clearMarkers();

    if (!checkpoints || checkpoints.length === 0) {
      return;
    }

    const popup = popupRef.current;

    // Create a prominent DOM Marker for each checkpoint
    checkpoints.forEach((cp) => {
      const risk = getRiskConfig(cp.arrival_weather?.risk_level);
      const isModerate = risk.level === "MODERATE";

      // Outer marker container (MapLibre controls its transform)
      const markerContainer = document.createElement("div");
      markerContainer.className = "spotter-checkpoint-marker";
      markerContainer.setAttribute(
        "title",
        `Checkpoint #${cp.index + 1} (${risk.label}) - Click to view details`,
      );

      // Inner badge container (receives hover & active scale animations without shifting coordinates)
      const badgeWrapper = document.createElement("div");
      badgeWrapper.className = "spotter-checkpoint-badge";

      // Transport Diamond Waypoint Shape (distinct from origin circle & destination pin)
      const diamond = document.createElement("div");
      diamond.className = "spotter-checkpoint-diamond";
      diamond.style.backgroundColor = risk.color;
      diamond.style.boxShadow = `0 3px 10px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0,0,0,0.15), 0 0 10px ${risk.color}90`;

      // Upright text inside the diamond
      const text = document.createElement("span");
      text.className = "spotter-checkpoint-text";
      text.style.color = isModerate ? "#0f172a" : "#ffffff";
      text.textContent = String(cp.index + 1);

      diamond.appendChild(text);
      badgeWrapper.appendChild(diamond);
      markerContainer.appendChild(badgeWrapper);

      // Click to Activate Checkpoint
      markerContainer.addEventListener("click", (e) => {
        e.stopPropagation();

        // Deactivate previous marker
        if (activeMarkerElRef.current && activeMarkerElRef.current !== markerContainer) {
          activeMarkerElRef.current.classList.remove("is-active");
        }

        // Activate clicked marker
        markerContainer.classList.add("is-active");
        activeMarkerElRef.current = markerContainer;

        // Display React-rendered detail popup card
        if (popup) {
          popup.setLngLat([cp.lng, cp.lat]).addTo(map);
        }
        setActiveCheckpoint(cp);

        onSelectCheckpointRef.current?.(cp);
      });

      // Anchor center ensures circle is perfectly centered on route coordinate
      const marker = new Marker({
        element: markerContainer,
        anchor: "center",
      })
        .setLngLat([cp.lng, cp.lat])
        .addTo(map);

      markersRef.current.push(marker);
    });

    // Dismiss active checkpoint popup when clicking anywhere else on the map canvas
    const handleMapClick = (e: { originalEvent?: MouseEvent }) => {
      const popupEl = popup?.getElement();
      if (popupEl && e.originalEvent?.target && popupEl.contains(e.originalEvent.target as Node)) {
        return;
      }

      if (popup) {
        popup.remove();
      }
      setActiveCheckpoint(null);
      if (activeMarkerElRef.current) {
        activeMarkerElRef.current.classList.remove("is-active");
        activeMarkerElRef.current = null;
      }
    };

    map.on("click", handleMapClick);

    return () => {
      map.off("click", handleMapClick);
      clearMarkers();
    };
  }, [map, checkpoints, routeId]);

  const handleClose = () => {
    if (popupRef.current) {
      popupRef.current.remove();
    }
    setActiveCheckpoint(null);
    if (activeMarkerElRef.current) {
      activeMarkerElRef.current.classList.remove("is-active");
      activeMarkerElRef.current = null;
    }
  };

  const popupContent = activeCheckpoint
    ? createPortal(
        <CheckpointCard checkpoint={activeCheckpoint} onClose={handleClose} />,
        popupContainer,
      )
    : null;

  return { activeCheckpoint, popupContent };
}
