import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface InfoTooltipProps {
  text: string;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
  maxWidth?: number;
}

/**
 * Small ⓘ icon that shows an explanatory tooltip on hover.
 * Use next to chart / table / KPI titles to narrate how the metric is measured,
 * calculated and defined — ensuring full transparency of the data-driven approach.
 */
export function InfoTooltip({
  text,
  className,
  side = "top",
  maxWidth = 320,
}: InfoTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center justify-center rounded-full text-muted-foreground/60 hover:text-muted-foreground transition-colors focus:outline-none ${className ?? ""}`}
            aria-label="Información"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          className="bg-popover text-popover-foreground border shadow-lg px-3 py-2 text-[11px] leading-relaxed"
          style={{ maxWidth }}
        >
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
