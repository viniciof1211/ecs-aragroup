import { Users, TrendingUp, Flame, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
    },
    {
      title: "Puntaje Promedio",
      value: avgScore.toString(),
      icon: TrendingUp,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      title: "Leads Calientes",
      value: hotLeads.toLocaleString("es-CR"),
      icon: Flame,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-500/10",
    },
    {
      title: "Tasa de Conversión",
      value: `${conversionRate}%`,
      icon: Target,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
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
              <p className="text-sm text-muted-foreground">{card.title}</p>
              <p className="font-display text-2xl font-bold">{card.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
