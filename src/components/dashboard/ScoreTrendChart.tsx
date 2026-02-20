import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { format, subDays, differenceInCalendarDays } from "date-fns";
import { useTimeRangeStore, getTimeRangeCutoff } from "@/stores/useTimeRangeStore";
import type { ECSLead } from "@/types/ecs";

interface ScoreTrendChartProps {
  leads: ECSLead[];
}

export function ScoreTrendChart({ leads }: ScoreTrendChartProps) {
  const range = useTimeRangeStore((s) => s.range);
  const now = new Date();
  const data: { date: string; avg: number }[] = [];

  // Determine how many days to show based on the global time filter
  const cutoff = getTimeRangeCutoff(range);
  const totalDays = cutoff
    ? differenceInCalendarDays(now, cutoff)
    : 180; // "all" → show last 180 days

  // Pre-compute lead dates once (avoid O(days × leads) format calls)
  const leadDates = leads
    .filter((l) => l.last_interaction_at)
    .map((l) => ({
      dateStr: l.last_interaction_at!.slice(0, 10), // "yyyy-MM-dd"
      score: l.current_score,
    }));

  // For large ranges, sample fewer points to keep the chart readable
  const step = totalDays > 90 ? Math.ceil(totalDays / 90) : 1;

  for (let i = totalDays; i >= 0; i -= step) {
    const day = subDays(now, i);
    const dayStr = format(day, "yyyy-MM-dd");
    const dayLabel = totalDays > 60
      ? format(day, "dd/MM/yy")
      : format(day, "dd/MM");

    const dayLeads = leadDates.filter((l) => l.dateStr <= dayStr);

    const avg =
      dayLeads.length > 0
        ? Math.round(
            dayLeads.reduce((s, l) => s + l.score, 0) / dayLeads.length
          )
        : 0;

    data.push({ date: dayLabel, avg });
  }

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-lg flex items-center gap-2">
          Tendencia de Puntaje ECS
          <InfoTooltip text="Promedio diario del ECS Score de todos los leads con interacción hasta esa fecha, filtrado según el rango de tiempo global seleccionado. El área sombreada muestra la evolución general de la calidad del pipeline. Una tendencia ascendente indica mejora en el engagement de los leads." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1A4A28" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#1A4A28" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
              }}
            />
            <Area
              type="monotone"
              dataKey="avg"
              stroke="#1A4A28"
              strokeWidth={2}
              fill="url(#scoreGrad)"
              name="Puntaje Promedio"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
