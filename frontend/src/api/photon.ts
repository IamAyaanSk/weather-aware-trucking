export interface PhotonGeometry {
  type: "Point";
  coordinates: [number, number]; // [lng, lat]
}

export interface PhotonProperties {
  osm_id?: number;
  osm_type?: string;
  osm_key?: string;
  osm_value?: string;
  type?: string;
  name?: string;
  street?: string;
  housenumber?: string;
  city?: string;
  district?: string;
  county?: string;
  state?: string;
  country?: string;
  countrycode?: string;
  postcode?: string;
  extent?: [number, number, number, number];
  [key: string]: unknown;
}

export interface PhotonFeature {
  type: "Feature";
  geometry: PhotonGeometry;
  properties: PhotonProperties;
}

export interface PhotonFeatureCollection {
  type: "FeatureCollection";
  features: PhotonFeature[];
}

export interface LocationSearchResult {
  id: string;
  name: string;
  subtitle: string;
  fullName: string;
  lat: number;
  lng: number;
}

const PHOTON_BASE_URL = "https://photon.komoot.io";

export function formatPhotonFeature(feature: PhotonFeature): LocationSearchResult {
  const p = feature.properties;
  const [lng, lat] = feature.geometry.coordinates;

  let name = p.name?.trim();
  if (!name) {
    if (p.street) {
      name = p.housenumber ? `${p.housenumber} ${p.street}` : p.street;
    } else if (p.city) {
      name = p.city;
    } else if (p.state) {
      name = p.state;
    } else {
      name = "Pinned location";
    }
  }

  const subtitleParts: string[] = [];

  // If name is a venue or POI, include street if available
  if (p.street && p.street !== name) {
    subtitleParts.push(p.housenumber ? `${p.housenumber} ${p.street}` : p.street);
  }

  // City / Town / Village
  if (p.city && p.city !== name) {
    subtitleParts.push(p.city);
  } else if (p.district && p.district !== name) {
    subtitleParts.push(p.district);
  }

  // State / Region
  if (p.state && p.state !== name) {
    subtitleParts.push(p.state);
  }

  // Country
  if (p.country && p.country !== name) {
    subtitleParts.push(p.country);
  }

  const subtitle = subtitleParts.join(", ");
  const fullName = subtitle ? `${name}, ${subtitle}` : name;

  return {
    id: `${p.osm_type ?? "N"}${p.osm_id ?? Math.random()}-${lng}-${lat}`,
    name,
    subtitle,
    fullName,
    lat,
    lng,
  };
}

/**
 * Searches Photon geocoder for places matching query.
 */
export async function searchPhotonLocations(
  query: string,
  signal?: AbortSignal,
  limit = 5,
): Promise<LocationSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const url = new URL(`${PHOTON_BASE_URL}/api/`);
  url.searchParams.set("q", trimmed);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("lang", "en");

  try {
    const response = await fetch(url.toString(), {
      signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as PhotonFeatureCollection;
    if (!data || !Array.isArray(data.features)) {
      return [];
    }

    return data.features.map(formatPhotonFeature);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    console.error("Photon search error:", error);
    return [];
  }
}

/**
 * Reverse geocodes coordinates to a human-readable location name using Photon.
 */
export async function reverseGeocodePhoton(
  lng: number,
  lat: number,
  signal?: AbortSignal,
): Promise<LocationSearchResult> {
  const url = new URL(`${PHOTON_BASE_URL}/reverse`);
  url.searchParams.set("lon", lng.toFixed(6));
  url.searchParams.set("lat", lat.toFixed(6));
  url.searchParams.set("lang", "en");

  try {
    const response = await fetch(url.toString(), {
      signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Reverse geocode failed with status ${response.status}`);
    }

    const data = (await response.json()) as PhotonFeatureCollection;
    if (data.features && data.features.length > 0) {
      const feat = data.features[0];
      const result = formatPhotonFeature(feat);
      // Ensure the coordinates match the requested target
      return {
        ...result,
        lat,
        lng,
      };
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    console.warn("Photon reverse geocode fallback:", error);
  }

  // Graceful fallback to friendly label instead of raw coordinates
  return {
    id: `coord-${lng}-${lat}`,
    name: "Pinned location",
    subtitle: "Selected on map",
    fullName: "Pinned location",
    lat,
    lng,
  };
}
