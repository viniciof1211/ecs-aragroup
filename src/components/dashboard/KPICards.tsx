import { Users, TrendingUp, Flame, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import type { ECSLead } from "@/types/ecs";

interface KPICardsProps {
  leads: ECSLead[];
}

export function KPICards({ leads }: KPICardsProps) {
  const totalLeads = leads.length;
  const avgScore =
    totalLeads > 0
      ? Math.round(leads.reduce((s, l) => s + l.current_score, 0) / totalLeads)
      : 0;
  const hotLeads = leads.filter((l) => l.current_score >= 80).length;
  const wonLeads = leads.filter((l) => l.status === "won").length;
  const conversionRate =
    totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;

  const cards = [
    {
      title: "Total Leads",
      value: totalLeads.toLocaleString("es-CR"),
      icon: Users,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10",
      info: "Cantidad total de leads en el sistema, incluyendo todos los estados (nuevos, contactados, calificados, ganados, perdidos). Se actualiza en tiempo real con cada polling de Bitrix24.",
    },
    {
      title: "Puntaje Promedio",
      value: avgScore.toString(),
      icon: TrendingUp,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
      info: "Promedio del ECS Score de todos los leads. El ECS Score (0-100) se calcula con un modelo multifactorial: frecuencia de interacciones, recencia, avance de pipeline, sentimiento de IA, y canal de comunicación.",
    },
    {
      title: "Leads Calientes",
      value: hotLeads.toLocaleString("es-CR"),
      icon: Flame,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-500/10",
      info: "Leads con ECS Score ≥80. Estos leads tienen alta probabilidad de conversión basada en interacciones recientes, avance de etapa, y sentimiento positivo. Son prioridad para el equipo comercial.",
    },
    {
      title: "Tasa de Conversión",
      value: `${conversionRate}%`,
      icon: Target,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
      info: "Porcentaje de leads ganados (status='won') sobre el total de leads. Fórmula: (Leads Ganados / Total Leads) × 100. Incluye todos los leads del período seleccionado.",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="shadow-card">
          <CardContent className="flex items-center gap-4 p-5">
            <div className={`rounded-xl p-3 ${card.bg}`}>
              <card.icon className={`h-6 w-6 ${card.color}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">{card.title} <InfoTooltip text={card.info} /></p>
              <p className="font-display text-2xl font-bold">{card.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
