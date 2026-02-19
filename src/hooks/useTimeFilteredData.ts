import { useMemo } from "react";
import { useTimeRangeStore, getTimeRangeCutoff } from "@/stores/useTimeRangeStore";
import type { ECSLead, ECSInteraction } from "@/types/ecs";

/**
 * Filters data based on the global time range.
 *
 * - **leads are NEVER filtered out** — Total Leads, KPIs, funnels, etc.
 *   must always reflect the full dataset.  Bitrix polling merges new /
 *   updated leads on top of the static ETL set.
 * - **interactions** are filtered by timestamp so time-based charts
 *   (activity feed, channel mix, heatmap, score trend) respect the range.
 * - **activeLeads** is a convenience subset: leads that had at least one
 *   interaction inside the selected window (useful for "active in period"
 *   metrics without hiding the rest).
 */
export function useTimeFilteredData(
  leads: ECSLead[],
  interactions: ECSInteraction[]
) {
  const range = useTimeRangeStore((s) => s.range);

  const filteredInteractions = useMemo(() => {
    const cutoff = getTimeRangeCutoff(range);
    if (!cutoff) return interactions;
    const cutoffStr = cutoff.toISOString();
    return interactions.filter((i) => i.timestamp >= cutoffStr);
  }, [interactions, range]);

  // Leads that had activity inside the window (optional helper)
  const activeLeadIds = useMemo(() => {
    const ids = new Set<string>();
    for (const i of filteredInteractions) {
      if (i.lead_id) ids.add(i.lead_id);
    }
    return ids;
  }, [filteredInteractions]);

  const activeLeads = useMemo(() => {
    if (range === "all") return leads;
    return leads.filter((l) => activeLeadIds.has(l.id) || activeLeadIds.has(l.lead_id));
  }, [leads, activeLeadIds, range]);

  return {
    /** ALL leads — always the full dataset */
    allLeads: leads,
    /** Leads with activity in the selected time window */
    activeLeads,
    /** Interactions filtered to the selected time window */
    filteredInteractions,
    range,
  };
}
