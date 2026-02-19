import { useMemo } from "react";
import { calculateECSScore } from "@/lib/ecs-engine";
import type { ECSInteraction, ECSScoreBreakdown } from "@/types/ecs";

export function useECSScore(interactions: ECSInteraction[]): ECSScoreBreakdown {
  return useMemo(() => calculateECSScore(interactions), [interactions]);
}
