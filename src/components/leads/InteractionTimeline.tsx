import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { INTERACTION_TYPE_LABELS } from "@/types/ecs";
import type { ECSInteraction } from "@/types/ecs";

const typeIcons: Record<string, React.ElementType> = {
  call: Phone,
  email_sent: Mail,
  email_received: Mail,
  whatsapp: MessageSquare,
  meeting: Calendar,
  note_added: FileText,
  chat: MessageSquare,
};

interface InteractionTimelineProps {
  interactions: ECSInteraction[];
}

export function InteractionTimeline({ interactions }: InteractionTimelineProps) {
  return (
    <ScrollArea className="h-[500px] pr-3">
      <div className="relative space-y-0">
        {interactions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sin interacciones registradas
          </p>
        ) : (
          interactions.map((interaction, idx) => {
            const Icon = typeIcons[interaction.type] || FileText;
            const label =
              INTERACTION_TYPE_LABELS[interaction.type] || interaction.type;
            const ts = new Date(interaction.timestamp);

            return (
              <div key={interaction.id} className="relative flex gap-4 pb-6">
                {/* Timeline line */}
                {idx < interactions.length - 1 && (
                  <div className="absolute left-[19px] top-10 h-full w-px bg-border" />
                )}

                {/* Icon */}
                <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card">
                  <Icon className="h-4 w-4 text-primary" />
                </div>

                {/* Content */}
                <div className="flex-1 rounded-lg border border-border/50 bg-card p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{label}</span>
                      {interaction.direction !== "unknown" && (
                        interaction.direction === "entrante" ? (
                          <ArrowDownLeft className="h-3.5 w-3.5 text-blue-500" />
                        ) : (
                          <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                        )
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(ts, { addSuffix: true, locale: es })}
                    </span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {interaction.channel && (
                      <Badge variant="secondary" className="text-[10px]">
                        {interaction.channel}
                      </Badge>
                    )}
                    {interaction.duration_seconds != null && interaction.duration_seconds > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {Math.round(interaction.duration_seconds / 60)} min
                      </span>
                    )}
                    {interaction.message_count != null && interaction.message_count > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {interaction.message_count} mensajes
                      </span>
                    )}
                    {interaction.employee && (
                      <span className="text-xs text-muted-foreground">
                        · {interaction.employee}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-[11px] text-muted-foreground/70">
                    {format(ts, "dd MMM yyyy, HH:mm", { locale: es })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </ScrollArea>
  );
}
