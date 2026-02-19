import { useQuery } from "@tanstack/react-query";
import type { ECSInteraction } from "@/types/ecs";

/**
 * Fetch ALL interactions (monolithic file — ~21MB).
 * Used by Dashboard/Analytics that need aggregate views.
 * Cached aggressively since it's static data.
 */
async function fetchAllInteractions(): Promise<ECSInteraction[]> {
  const res = await fetch("/data/interactions.json");
  if (!res.ok) throw new Error(`Failed to fetch interactions: ${res.status}`);
  const data: ECSInteraction[] = await res.json();
  data.sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""));
  return data;
}

/**
 * Fetch interactions for a single lead (per-lead file — tiny).
 * Used by LeadProfile for on-demand loading.
 */
async function fetchLeadInteractions(leadId: string): Promise<ECSInteraction[]> {
  const res = await fetch(`/data/interactions/${leadId}.json`);
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`Failed to fetch lead interactions: ${res.status}`);
  }
  const data: ECSInteraction[] = await res.json();
  data.sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""));
  return data;
}

export function useInteractions() {
  return useQuery<ECSInteraction[]>({
    queryKey: ["interactions"],
    queryFn: fetchAllInteractions,
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useLeadInteractions(leadId: string | undefined) {
  return useQuery<ECSInteraction[]>({
    queryKey: ["interactions", leadId],
    queryFn: () => fetchLeadInteractions(leadId!),
    enabled: !!leadId,
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
}
