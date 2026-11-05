/**
 * DOM Marker Element creators for MapLibre map pins.
 */

export function createOriginMarkerElement(): HTMLElement {
  const container = document.createElement("div");
  container.className = "spotter-marker origin-marker group";
  container.setAttribute("title", "Origin (Drag to adjust)");

  const pin = document.createElement("div");
  pin.className =
    "relative flex items-center justify-center size-7 rounded-full bg-background border-2 border-emerald-500 shadow-md transition-transform group-hover:scale-105";
  pin.innerHTML = `
    <span class="size-2.5 rounded-full bg-emerald-500"></span>
  `;
  container.appendChild(pin);

  return container;
}

export function createDestinationMarkerElement(): HTMLElement {
  const container = document.createElement("div");
  container.className = "spotter-marker destination-marker group";
  container.setAttribute("title", "Destination (Drag to adjust)");

  const pin = document.createElement("div");
  pin.className =
    "relative flex flex-col items-center drop-shadow-md transition-transform group-hover:scale-105";
  pin.innerHTML = `
    <svg viewBox="0 0 24 24" class="size-7 text-destructive" fill="currentColor">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/>
      <circle cx="12" cy="9" r="2.2" fill="white" />
    </svg>
  `;
  container.appendChild(pin);

  return container;
}
