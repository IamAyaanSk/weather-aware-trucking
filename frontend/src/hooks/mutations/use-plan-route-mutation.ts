import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { planRoute } from "../../api/endpoints/routes";
import type { PlanRouteRequest, PlanRouteResponse } from "../../api/types";

export function usePlanRouteMutation(): UseMutationResult<
  PlanRouteResponse,
  Error,
  PlanRouteRequest
> {
  return useMutation({
    mutationFn: planRoute,
  });
}
