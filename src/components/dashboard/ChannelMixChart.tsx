import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { channelMixData } from "@/lib/analytics-engine";
import { CHANNEL_LABELS } from "@/types/ecs";
import type { ECSInteraction } from "@/types/ecs";

const COLORS = ["#1A4A28", "#2A6A3A", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"];

interface ChannelMixChartProps {
  interactions: ECSInteraction[];
}

export function ChannelMixChart({ interactions }: ChannelMixChartProps) {
  const data = channelMixData(interactions).map((d) => ({
    ...d,
    name: CHANNEL_LABELS[d.name] || d.name,
  }));

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-lg flex items-center gap-2">
          Mix de Canales
          <InfoTooltip text="Distribución porcentual de interacciones por canal de comunicación (WhatsApp, Email, Teléfono, Chat, Reunión, etc.). Los datos provienen de las interacciones registradas en Bitrix24. Permite identificar los canales más utilizados por el equipo comercial." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
