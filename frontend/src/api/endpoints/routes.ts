import { apiClient } from "../client";
import type { PlanRouteRequest, PlanRouteResponse } from "../types";

export async function planRoute(payload: PlanRouteRequest): Promise<PlanRouteResponse> {
  const { data } = await apiClient.post<PlanRouteResponse>("/routes/plan/", payload);
  return data;
}

export async function checkHealth(): Promise<{ status: string }> {
  const { data } = await apiClient.get<{ status: string }>("/health/");
  return data;
}
