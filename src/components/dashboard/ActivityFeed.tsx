import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface ActivityFeedProps {
  interactions: ECSInteraction[];
}

export function ActivityFeed({ interactions }: ActivityFeedProps) {
  const recent = interactions.slice(0, 20);

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-lg">
          Actividad Reciente
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[360px] pr-3">
          <div className="space-y-3">
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sin actividad reciente
              </p>
            ) : (
              recent.map((interaction) => {
                const Icon = typeIcons[interaction.type] || FileText;
                const label =
                  INTERACTION_TYPE_LABELS[interaction.type] || interaction.type;
                const timeAgo = formatDistanceToNow(
                  new Date(interaction.timestamp),
                  { addSuffix: true, locale: es }
                );

                return (
                  <div
                    key={interaction.id}
                    className="flex items-start gap-3 rounded-lg border border-border/50 p-3"
                  >
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{label}</span>
                        {interaction.direction !== "unknown" && (
                          <span className="text-muted-foreground">
                            {interaction.direction === "entrante" ? (
                              <ArrowDownLeft className="h-3.5 w-3.5 text-blue-500" />
                            ) : (
                              <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                            )}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {interaction.channel && (
                          <Badge variant="outline" className="mr-1 text-[10px]">
                            {interaction.channel}
                          </Badge>
                        )}
                        {timeAgo}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
