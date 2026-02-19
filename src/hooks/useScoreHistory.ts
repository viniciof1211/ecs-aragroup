import { useQuery } from "@tanstack/react-query";
import type { ScoreSnapshot } from "@/types/ecs";

/**
 * Fetch score history for a single lead (per-lead file).
 */
async function fetchLeadScoreHistory(leadId: string): Promise<ScoreSnapshot[]> {
  const res = await fetch(`/data/score_history/${leadId}.json`);
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`Failed to fetch score history: ${res.status}`);
  }
  return res.json();
}

export function useLeadScoreHistory(leadId: string | undefined) {
  return useQuery<ScoreSnapshot[]>({
    queryKey: ["score_history", leadId],
    queryFn: () => fetchLeadScoreHistory(leadId!),
    enabled: !!leadId,
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
}
