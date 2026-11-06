import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { planRoute } from "../../api/endpoints/routes";
import type { PlanRouteRequest, PlanRouteResponse } from "../../api/types";

export const routePlanKeys = {
  all: ["routes"] as const,
  plan: (params: PlanRouteRequest | null) => ["routes", "plan", params] as const,
};

export function useRoutePlanQuery(
  params: PlanRouteRequest | null,
): UseQueryResult<PlanRouteResponse, Error> {
  return useQuery({
    queryKey: routePlanKeys.plan(params),
    queryFn: () => {
      if (!params) {
        throw new Error("Route parameters are required");
      }
      return planRoute(params);
    },
    enabled: Boolean(params && params.origin && params.destination && params.departure_time),
    staleTime: 1000 * 60 * 5,
  });
}
