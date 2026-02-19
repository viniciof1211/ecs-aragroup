import { useQuery, useMutation } from "@tanstack/react-query";
import { bitrixHealth, bitrixStats, bitrixPollState, bitrixTriggerPoll } from "@/lib/api";

export function useBitrixHealth() {
  return useQuery({
    queryKey: ["bitrix-health"],
    queryFn: bitrixHealth,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useBitrixStats() {
  return useQuery({
    queryKey: ["bitrix-stats"],
    queryFn: bitrixStats,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useBitrixPollState() {
  return useQuery({
    queryKey: ["bitrix-poll-state"],
    queryFn: bitrixPollState,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });
}

export function useBitrixTriggerPoll() {
  return useMutation({
    mutationFn: bitrixTriggerPoll,
  });
}
