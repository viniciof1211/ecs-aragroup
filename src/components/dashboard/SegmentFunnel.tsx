import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { SEGMENT_CONFIGS } from "@/types/ecs";
import type { ECSLead, Segment } from "@/types/ecs";

interface SegmentFunnelProps {
  leads: ECSLead[];
}

export function SegmentFunnel({ leads }: SegmentFunnelProps) {
  const total = leads.length || 1;
  const counts = new Map<Segment, number>();
  for (const lead of leads) {
    const seg = lead.segment || "lost";
    counts.set(seg, (counts.get(seg) ?? 0) + 1);
  }

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-lg flex items-center gap-2">
          Distribución por Segmento
          <InfoTooltip text="Proporción de leads por segmento ECS. Los segmentos se asignan automáticamente según el ECS Score: Hot (≥80), Warm (≥60), Cool (≥40), Cold (≥20), Dormant (<20), Lost (cerrados perdidos). La barra muestra el porcentaje relativo de cada segmento sobre el total." />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {SEGMENT_CONFIGS.map((seg) => {
          const count = counts.get(seg.name) ?? 0;
          const pct = Math.round((count / total) * 100);
          return (
            <div key={seg.name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span>{seg.icon}</span>
                  <span className="font-medium">{seg.label}</span>
                </span>
                <span className="text-muted-foreground">
                  {count.toLocaleString("es-CR")} ({pct}%)
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: seg.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
