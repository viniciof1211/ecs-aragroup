import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ECSLead } from "@/types/ecs";

async function fetchLeads(): Promise<ECSLead[]> {
  const res = await fetch("/data/leads.json");
  if (!res.ok) throw new Error(`Failed to fetch leads: ${res.status}`);
  const data: ECSLead[] = await res.json();
  // Sort by score descending
  data.sort((a, b) => b.current_score - a.current_score);
  return data;
}

export function useLeads() {
  return useQuery<ECSLead[]>({
    queryKey: ["leads"],
    queryFn: fetchLeads,
    staleTime: 5 * 60_000, // 5 min — static data
    refetchOnWindowFocus: false,
  });
}

export function useLead(id: string | undefined) {
  const queryClient = useQueryClient();

  return useQuery<ECSLead | null>({
    queryKey: ["lead", id],
    queryFn: async () => {
      if (!id) return null;
      // Try to find in already-cached leads list first
      const cached = queryClient.getQueryData<ECSLead[]>(["leads"]);
      if (cached) {
        return cached.find((l) => l.id === id) ?? null;
      }
      // Fallback: fetch all and find
      const all = await fetchLeads();
      return all.find((l) => l.id === id) ?? null;
    },
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}
