import axios from "axios";

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
  return config;
});
