import { useParams, useNavigate } from "react-router-dom";
import { Loader2, ArrowLeft, ExternalLink, Mail, Phone, Building2, DollarSign, MapPin, Briefcase, Calendar, Tag } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { useLead } from "@/hooks/useLeads";
import { useLeadInteractions } from "@/hooks/useInteractions";
import { useLeadScoreHistory } from "@/hooks/useScoreHistory";
import { useECSScore } from "@/hooks/useECSScore";
import { useSentimentStore } from "@/stores/useSentimentStore";
import { applySentimentBonus } from "@/lib/ecs-engine";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InteractionTimeline } from "@/components/leads/InteractionTimeline";
import { ScoreBreakdown } from "@/components/leads/ScoreBreakdown";
import { SentimentCard } from "@/components/leads/SentimentCard";
import { QuickActions } from "@/components/leads/QuickActions";
import { LeadAdvisorChat } from "@/components/leads/LeadAdvisorChat";
import { getSegmentConfig, getSegmentFromScore, STATUS_LABELS, CHANNEL_LABELS } from "@/types/ecs";

const COLORS = ["#1A4A28", "#2A6A3A", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"];

export default function LeadProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: lead, isLoading: leadLoading } = useLead(id);
  const { data: interactions = [], isLoading: intLoading } = useLeadInteractions(id);
  const { data: scoreHistory = [] } = useLeadScoreHistory(id);
  const breakdown = useECSScore(interactions);
  const sentimentResult = useSentimentStore((s) => lead ? s.results[lead.id] : undefined);
  const sentimentResultFull = useSentimentStore((s) => lead ? s.results[lead.id] : null);
  const sentimentBonus = sentimentResult?.ecs_sentiment_bonus ?? 0;

  if (leadLoading || intLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Cargando perfil...</span>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Lead no encontrado</p>
        <Button variant="outline" onClick={() => navigate("/leads")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a Leads
        </Button>
      </div>
    );
  }

  const segment = lead.segment || getSegmentFromScore(lead.current_score);
  const segConfig = getSegmentConfig(segment);

  // Channel breakdown data
  const channelCounts = new Map<string, number>();
  for (const i of interactions) {
    const ch = i.channel || "unknown";
    channelCounts.set(ch, (channelCounts.get(ch) ?? 0) + 1);
  }
  const channelData = Array.from(channelCounts.entries())
    .map(([name, value]) => ({ name: CHANNEL_LABELS[name] || name, value }))
    .sort((a, b) => b.value - a.value);

  // Employee history
  const employees = new Set<string>();
  for (const i of interactions) {
    if (i.employee) employees.add(i.employee);
  }

  // Real longitudinal score history from ETL
  const scoreChartData = scoreHistory.map((s) => ({
    date: s.calculated_at ? format(new Date(s.calculated_at), "dd MMM yy", { locale: es }) : "",
    score: s.score,
    interactions: s.interaction_count,
  }));

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => navigate("/leads")}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver a Leads
      </Button>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column (2/3) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Lead Header */}
          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h1 className="font-display text-2xl font-bold">{lead.name}</h1>
                    <Badge
                      className="font-display text-sm font-bold text-white"
                      style={{ backgroundColor: segConfig.color }}
                    >
                      {segConfig.icon} {segConfig.label}
                    </Badge>
                    <Badge variant="outline">
                      {STATUS_LABELS[lead.status] || lead.status}
                    </Badge>
                  </div>

                  {/* Bitrix Lead IDs */}
                  {lead.bitrix_lead_ids && lead.bitrix_lead_ids.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium">Bitrix IDs:</span>
                      <span className="font-mono">
                        {lead.bitrix_lead_ids.join(", ")}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    {lead.company && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-4 w-4" />
                        {lead.company}
                      </span>
                    )}
                    {lead.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        {lead.email}
                      </span>
                    )}
                    {lead.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-4 w-4" />
                        {lead.phone}
                      </span>
                    )}
                  </div>

                  {lead.brand && (
                    <Badge variant="secondary">{lead.brand}</Badge>
                  )}
                </div>

                {/* Score Gauge */}
                <div className="flex flex-col items-center">
                  <div
                    className="flex h-20 w-20 items-center justify-center rounded-full border-4"
                    style={{ borderColor: segConfig.color }}
                  >
                    <span className="font-display text-2xl font-bold">
                      {sentimentBonus !== 0
                        ? applySentimentBonus(lead.current_score, sentimentBonus)
                        : lead.current_score}
                    </span>
                  </div>
                  <span className="mt-1 text-xs text-muted-foreground">
                    ECS Score
                  </span>
                  {sentimentBonus !== 0 && (
                    <span className={`text-[10px] font-display font-semibold ${
                      sentimentBonus >= 0 ? "text-emerald-600" : "text-red-500"
                    }`}>
                      base: {lead.current_score} {sentimentBonus >= 0 ? "+" : ""}{sentimentBonus.toFixed(1)} IA
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Score Breakdown Radar */}
          <ScoreBreakdown breakdown={breakdown} />

          {/* Score History (longitudinal) */}
          {scoreChartData.length > 1 && (
            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-lg">
                  Historial de Puntaje ECS (Longitudinal)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={scoreChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                        fontSize: "0.875rem",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#1A4A28"
                      strokeWidth={2}
                      dot={{ fill: "#1A4A28", r: 3 }}
                      name="Puntaje ECS"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Interaction Timeline */}
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-lg">
                Línea de Tiempo ({interactions.length} interacciones)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InteractionTimeline interactions={interactions} />
            </CardContent>
          </Card>
        </div>

        {/* Right Column (1/3) - Sidebar */}
        <div className="space-y-6">
          <QuickActions lead={lead} />

          <SentimentCard lead={lead} interactions={interactions} />

          {/* Extended Lead Info */}
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-lg">Detalles del Lead</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {lead.division && (
                <div className="flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">División:</span>
                  <span className="font-medium">{lead.division}</span>
                </div>
              )}
              {lead.sucursal && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Sucursal:</span>
                  <span className="font-medium">{lead.sucursal}</span>
                </div>
              )}
              {lead.cargo && (
                <div className="flex items-center gap-2">
                  <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Cargo:</span>
                  <span className="font-medium">{lead.cargo}</span>
                </div>
              )}
              {lead.budget_range && (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Presupuesto:</span>
                  <Badge variant="secondary">{lead.budget_range}</Badge>
                </div>
              )}
              {lead.total_amount != null && lead.total_amount > 0 && (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Monto:</span>
                  <span className="font-medium">${lead.total_amount.toLocaleString("es-CR")} {lead.currency}</span>
                </div>
              )}
              {lead.project_type && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Proyecto:</span>
                  <span className="font-medium">{lead.project_type}</span>
                </div>
              )}
              {lead.designing && (
                <div className="flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Diseñando:</span>
                  <span className="font-medium">{lead.designing}</span>
                </div>
              )}
              {lead.product_sold && (
                <div className="flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Producto:</span>
                  <Badge variant="default">{lead.product_sold}</Badge>
                </div>
              )}
              {lead.client_type && (
                <div className="flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Tipo cliente:</span>
                  <span className="font-medium">{lead.client_type}</span>
                </div>
              )}
              {lead.loss_reason_raw && (
                <div className="flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5 text-red-400" />
                  <span className="text-muted-foreground">Razón pérdida:</span>
                  <Badge variant="destructive" className="text-[10px]">{lead.loss_reason_raw}</Badge>
                </div>
              )}
              {lead.etapa_bitrix && (
                <div className="flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Etapa Bitrix:</span>
                  <span className="font-medium">{lead.etapa_bitrix}</span>
                </div>
              )}
              {lead.first_seen && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Primera vez:</span>
                  <span className="font-medium">{format(new Date(lead.first_seen), "dd MMM yyyy", { locale: es })}</span>
                </div>
              )}
              {lead.last_seen && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Último contacto:</span>
                  <span className="font-medium">{format(new Date(lead.last_seen), "dd MMM yyyy", { locale: es })}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Channel Breakdown */}
          {channelData.length > 0 && (
            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-lg">
                  Canales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={channelData} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} className="fill-muted-foreground" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                        fontSize: "0.875rem",
                      }}
                    />
                    <Bar dataKey="value" name="Interacciones" radius={[0, 4, 4, 0]}>
                      {channelData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Employee History */}
          {employees.size > 0 && (
            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-lg">
                  Empleados Asignados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {Array.from(employees).map((emp) => (
                    <div key={emp} className="rounded-md bg-muted/50 px-3 py-1.5 text-sm">
                      {emp}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Bitrix Link */}
          {lead.bitrix_id && (
            <Card className="shadow-card">
              <CardContent className="p-4">
                <a
                  href={`https://hogaresfuncionales.bitrix24.es/crm/lead/details/${lead.bitrix_id}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  Ver en Bitrix24 CRM (ID: {lead.bitrix_id})
                </a>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* AI Advisor Chat Widget */}
      <LeadAdvisorChat
        lead={lead}
        interactions={interactions}
        sentimentResult={sentimentResultFull}
      />
    </div>
  );
}
