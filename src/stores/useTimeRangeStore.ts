import { create } from "zustand";
import { persist } from "zustand/middleware";
import { subMonths, subWeeks } from "date-fns";

export type TimeRangeKey = "6m" | "3m" | "1m" | "1w" | "all";

export const TIME_RANGE_LABELS: Record<TimeRangeKey, string> = {
  "6m": "6 Meses",
  "3m": "3 Meses",
  "1m": "1 Mes",
  "1w": "1 Semana",
  all: "Todo",
};

interface TimeRangeState {
  range: TimeRangeKey;
  setRange: (range: TimeRangeKey) => void;
}

export const useTimeRangeStore = create<TimeRangeState>()(
  persist(
    (set) => ({
      range: "all",
      setRange: (range) => set({ range }),
    }),
    { name: "ecs-time-range" }
  )
);

/** Returns the cutoff Date for the current range, or null for "all" */
export function getTimeRangeCutoff(range: TimeRangeKey): Date | null {
  const now = new Date();
  switch (range) {
    case "6m":
      return subMonths(now, 6);
    case "3m":
      return subMonths(now, 3);
    case "1m":
      return subMonths(now, 1);
    case "1w":
      return subWeeks(now, 1);
    case "all":
      return null;
  }
}
