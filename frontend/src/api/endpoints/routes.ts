import { apiClient } from "../client";
import type { PlanRouteRequest, PlanRouteResponse } from "../types";

export async function planRoute(payload: PlanRouteRequest): Promise<PlanRouteResponse> {
  const { data } = await apiClient.get<PlanRouteResponse>("/routes/plan/", {
    params: {
      origin_lat: payload.origin.lat,
      origin_lng: payload.origin.lng,
      origin_name: payload.origin.name,
      dest_lat: payload.destination.lat,
      dest_lng: payload.destination.lng,
      dest_name: payload.destination.name,
      departure_time: payload.departure_time,
      load_weight_lbs: payload.load_weight_lbs,
    },
  });
  return data;
}

export async function checkHealth(): Promise<{ status: string }> {
  const { data } = await apiClient.get<{ status: string }>("/health/");
  return data;
}
