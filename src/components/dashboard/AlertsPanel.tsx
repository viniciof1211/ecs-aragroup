import { differenceInDays } from "date-fns";
import { AlertTriangle, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import type { ECSLead } from "@/types/ecs";

interface AlertsPanelProps {
  leads: ECSLead[];
}

export function AlertsPanel({ leads }: AlertsPanelProps) {
  const navigate = useNavigate();
  const now = new Date();

  const alerts: Array<{
    id: string;
    leadId: string;
    leadName: string;
    type: "threshold" | "inactive";
    message: string;
    severity: "high" | "medium";
  }> = [];

  for (const lead of leads) {
    const delta = lead.current_score - lead.previous_score;
    if (delta < -10) {
      alerts.push({
        id: `drop-${lead.id}`,
        leadId: lead.id,
        leadName: lead.name,
        type: "threshold",
        message: `Caída de ${Math.abs(delta)} puntos (${lead.previous_score} → ${lead.current_score})`,
        severity: "high",
      });
    }

    if (lead.last_interaction_at) {
      const daysSince = differenceInDays(now, new Date(lead.last_interaction_at));
      if (daysSince >= 14 && lead.current_score >= 20) {
        alerts.push({
          id: `inactive-${lead.id}`,
          leadId: lead.id,
          leadName: lead.name,
          type: "inactive",
          message: `Sin interacción hace ${daysSince} días`,
          severity: daysSince >= 30 ? "high" : "medium",
        });
      }
    }
  }

  const sorted = alerts.sort((a, b) =>
    a.severity === "high" && b.severity !== "high" ? -1 : 1
  ).slice(0, 15);

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Alertas
          {sorted.length > 0 && (
            <Badge variant="destructive" className="ml-1">
              {sorted.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[280px] pr-3">
          <div className="space-y-2">
            {sorted.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sin alertas activas
              </p>
            ) : (
              sorted.map((alert) => (
                <div
                  key={alert.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/50 p-3 transition-colors hover:bg-muted"
                  onClick={() => navigate(`/leads/${alert.leadId}`)}
                >
                  {alert.type === "threshold" ? (
                    <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {alert.leadName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {alert.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
