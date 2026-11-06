import axios from "axios";

export const SITE_ACCESS_TOKEN_KEY = "spotter_site_token";

export function getStoredSiteToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(SITE_ACCESS_TOKEN_KEY);
}

export function setStoredSiteToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SITE_ACCESS_TOKEN_KEY, token);
}

export function clearStoredSiteToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SITE_ACCESS_TOKEN_KEY);
}

function getClientId(): string {
  if (typeof window === "undefined") {
    return "anonymous";
  }
  const storageKey = "trucking_client_id";
  let clientId = window.localStorage.getItem(storageKey);
  if (!clientId) {
    clientId = crypto.randomUUID();
    window.localStorage.setItem(storageKey, clientId);
  }
  return clientId;
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  config.headers.set("X-Client-Id", getClientId());

  const siteToken = getStoredSiteToken();
  if (siteToken) {
    config.headers.set("X-Site-Access-Token", siteToken);
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403) {
      clearStoredSiteToken();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("spotter:unauthorized"));
      }
    }
    return Promise.reject(error);
  },
);
