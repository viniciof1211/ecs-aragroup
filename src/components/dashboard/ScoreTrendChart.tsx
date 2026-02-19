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
import { format, subDays } from "date-fns";
import type { ECSLead } from "@/types/ecs";

interface ScoreTrendChartProps {
  leads: ECSLead[];
}

export function ScoreTrendChart({ leads }: ScoreTrendChartProps) {
  const now = new Date();
  const data: { date: string; avg: number }[] = [];

  // Pre-compute lead dates once (avoid O(days × leads) format calls)
  const leadDates = leads
    .filter((l) => l.last_interaction_at)
    .map((l) => ({
      dateStr: l.last_interaction_at!.slice(0, 10), // "yyyy-MM-dd"
      score: l.current_score,
    }));

  for (let i = 30; i >= 0; i--) {
    const day = subDays(now, i);
    const dayStr = format(day, "yyyy-MM-dd");
    const dayLabel = format(day, "dd/MM");

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
        <CardTitle className="font-display text-lg">
          Tendencia de Puntaje ECS (30 días)
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
