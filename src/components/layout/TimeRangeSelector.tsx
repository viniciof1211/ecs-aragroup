import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useTimeRangeStore,
  TIME_RANGE_LABELS,
  type TimeRangeKey,
} from "@/stores/useTimeRangeStore";
import { cn } from "@/lib/utils";

const RANGES: TimeRangeKey[] = ["1w", "1m", "3m", "6m", "all"];

export function TimeRangeSelector() {
  const { range, setRange } = useTimeRangeStore();

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-0.5">
      <Calendar className="ml-1.5 h-3.5 w-3.5 text-muted-foreground" />
      {RANGES.map((r) => (
        <Button
          key={r}
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 px-2.5 text-xs font-medium",
            range === r
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setRange(r)}
        >
          {TIME_RANGE_LABELS[r]}
        </Button>
      ))}
    </div>
  );
}
