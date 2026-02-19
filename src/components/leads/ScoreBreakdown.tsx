import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ECSScoreBreakdown } from "@/types/ecs";

interface ScoreBreakdownProps {
  breakdown: ECSScoreBreakdown;
}

export function ScoreBreakdown({ breakdown }: ScoreBreakdownProps) {
  const raw = [
    { subject: "Recencia", value: breakdown.recency, max: 25 },
    { subject: "Frecuencia", value: breakdown.frequency, max: 25 },
    { subject: "Profundidad", value: breakdown.depth, max: 25 },
    { subject: "Canales", value: breakdown.channelDiversity, max: 15 },
    { subject: "Velocidad", value: breakdown.velocity, max: 10 },
  ];

  // Normalize to 0-100 so every axis uses the same scale and the radar
  // shape accurately reflects each dimension's proportion of its max.
  const data = raw.map((d) => ({
    ...d,
    pct: d.max > 0 ? Math.round((d.value / d.max) * 100) : 0,
  }));

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-lg">
          Desglose del Puntaje
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <RadarChart data={data}>
            <PolarGrid className="stroke-border" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={false}
              axisLine={false}
            />
            <Radar
              name="Puntaje"
              dataKey="pct"
              stroke="#1A4A28"
              fill="#1A4A28"
              fillOpacity={0.25}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>

        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          {raw.map((d) => (
            <div key={d.subject} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5">
              <span className="text-muted-foreground">{d.subject}</span>
              <span className="font-display font-semibold">
                {d.value}/{d.max}
              </span>
            </div>
          ))}
          <div className="col-span-2 flex items-center justify-between rounded-md bg-primary/10 px-3 py-1.5">
            <span className="font-medium">Total</span>
            <span className="font-display text-lg font-bold text-primary">
              {breakdown.total}/100
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
