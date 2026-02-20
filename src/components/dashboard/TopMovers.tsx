import { ArrowUp, ArrowDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import type { ECSLead } from "@/types/ecs";

interface TopMoversProps {
  leads: ECSLead[];
}

export function TopMovers({ leads }: TopMoversProps) {
  const navigate = useNavigate();

  const withDelta = leads
    .map((l) => ({
      ...l,
      delta: l.current_score - l.previous_score,
    }))
    .filter((l) => l.delta !== 0);

  const risers = [...withDelta]
    .filter((l) => l.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 5);

  const decliners = [...withDelta]
    .filter((l) => l.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 5);

  const renderList = (
    items: typeof risers,
    type: "up" | "down"
  ) => (
    <div className="space-y-2">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin movimientos</p>
      ) : (
        items.map((lead) => (
          <div
            key={lead.id}
            className="flex cursor-pointer items-center justify-between rounded-lg p-2 transition-colors hover:bg-muted"
            onClick={() => navigate(`/leads/${lead.id}`)}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{lead.name}</p>
              <p className="text-xs text-muted-foreground">
                Score: {lead.current_score}
              </p>
            </div>
            <Badge
              variant={type === "up" ? "default" : "destructive"}
              className="ml-2 shrink-0"
            >
              {type === "up" ? (
                <ArrowUp className="mr-1 h-3 w-3" />
              ) : (
                <ArrowDown className="mr-1 h-3 w-3" />
              )}
              {type === "up" ? "+" : ""}
              {lead.delta}
            </Badge>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <ArrowUp className="h-5 w-5 text-emerald-500" />
            Top Subidas
            <InfoTooltip text="Los 5 leads con mayor incremento de ECS Score respecto a su puntaje anterior. El delta se calcula como: Score Actual − Score Anterior. Un aumento indica mayor engagement, avance de etapa o sentimiento positivo reciente." />
          </CardTitle>
        </CardHeader>
        <CardContent>{renderList(risers, "up")}</CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <ArrowDown className="h-5 w-5 text-red-500" />
            Top Bajadas
            <InfoTooltip text="Los 5 leads con mayor caída de ECS Score. Estos leads requieren atención inmediata: posible falta de seguimiento, sentimiento negativo, o inactividad prolongada. Se recomienda intervención del equipo comercial." />
          </CardTitle>
        </CardHeader>
        <CardContent>{renderList(decliners, "down")}</CardContent>
      </Card>
    </div>
  );
}
