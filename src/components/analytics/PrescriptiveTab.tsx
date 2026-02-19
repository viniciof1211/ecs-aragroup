import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  AlertCircle,
  Calculator,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { priorityActionQueue } from "@/lib/analytics-engine";
import { getSegmentConfig } from "@/types/ecs";
import type { ECSLead, ECSInteraction } from "@/types/ecs";

const channelIcons: Record<string, React.ElementType> = {
  phone: Phone,
  email: Mail,
  whatsapp: MessageSquare,
  meeting: Calendar,
  bitrix: AlertCircle,
};

interface PrescriptiveTabProps {
  leads: ECSLead[];
  interactions: ECSInteraction[];
}

export function PrescriptiveTab({ leads, interactions }: PrescriptiveTabProps) {
  const navigate = useNavigate();
  const actions = priorityActionQueue(leads, interactions);

  // ROI Calculator state
  const [campaignCost, setCampaignCost] = useState(500000);
  const [targetSize, setTargetSize] = useState(50);
  const [expectedLift, setExpectedLift] = useState(15);

  const avgDealValue = 2_500_000;
  const projectedConversions = Math.round(targetSize * (expectedLift / 100));
  const projectedRevenue = projectedConversions * avgDealValue;
  const projectedROI =
    campaignCost > 0
      ? Math.round(((projectedRevenue - campaignCost) / campaignCost) * 100)
      : 0;
  const breakEven =
    avgDealValue > 0 ? Math.ceil(campaignCost / avgDealValue) : 0;

  // Re-engagement campaigns
  const coldLeads = leads.filter(
    (l) => l.current_score >= 5 && l.current_score < 40
  );
  const dormantLeads = leads.filter((l) => l.current_score < 5);

  const campaigns = [
    {
      name: "Reactivación Fríos — WhatsApp",
      target: `${coldLeads.length} leads fríos`,
      channel: "WhatsApp",
      expectedRate: "12-18%",
      description:
        "Mensaje personalizado de seguimiento con oferta especial para leads que no han interactuado en 14+ días",
    },
    {
      name: "Reactivación Inactivos — Email",
      target: `${dormantLeads.length} leads inactivos`,
      channel: "Email",
      expectedRate: "5-8%",
      description:
        "Campaña de email con contenido de valor (catálogo, casos de éxito) para leads dormidos",
    },
    {
      name: "Nurturing Tibios — Multi-canal",
      target: `${leads.filter((l) => l.current_score >= 60 && l.current_score < 80).length} leads tibios`,
      channel: "Multi-canal",
      expectedRate: "25-35%",
      description:
        "Secuencia de contacto: WhatsApp → Llamada → Email con cotización personalizada",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Priority Action Queue */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg">
            Cola de Acciones Prioritarias
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead>Segmento</TableHead>
                  <TableHead>Acción Recomendada</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Urgencia</TableHead>
                  <TableHead className="text-right">Impacto Est.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {actions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Sin acciones pendientes
                    </TableCell>
                  </TableRow>
                ) : (
                  actions.map((action) => {
                    const segConfig = getSegmentConfig(action.segment);
                    const ChannelIcon =
                      channelIcons[action.channel] || AlertCircle;
                    return (
                      <TableRow key={action.leadId} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/leads/${action.leadId}`)}>
                        <TableCell className="font-medium text-primary hover:underline">
                          {action.leadName}
                        </TableCell>
                        <TableCell className="text-right">
                          {action.currentScore}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className="text-[10px] text-white"
                            style={{ backgroundColor: segConfig.color }}
                          >
                            {segConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] text-sm">
                          {action.recommendedAction}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <ChannelIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs">{action.channel}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              action.urgency === "high"
                                ? "destructive"
                                : action.urgency === "medium"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {action.urgency === "high"
                              ? "Alta"
                              : action.urgency === "medium"
                                ? "Media"
                                : "Baja"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-display font-semibold text-emerald-600">
                          +{action.expectedImpact}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Re-engagement Campaigns + ROI Calculator */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Campaigns */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg">
              Campañas de Reactivación Sugeridas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {campaigns.map((campaign) => (
              <div
                key={campaign.name}
                className="rounded-lg border border-border p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">{campaign.name}</h4>
                  <Badge variant="outline">{campaign.channel}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {campaign.description}
                </p>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-muted-foreground">
                    Audiencia: <strong>{campaign.target}</strong>
                  </span>
                  <span className="text-muted-foreground">
                    Tasa esperada: <strong>{campaign.expectedRate}</strong>
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ROI Calculator */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <Calculator className="h-5 w-5" />
              Calculadora de ROI
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Costo de Campaña (₡)</Label>
                <Input
                  type="number"
                  value={campaignCost}
                  onChange={(e) => setCampaignCost(Number(e.target.value))}
                />
              </div>
              <div>
                <Label className="text-xs">Leads Objetivo</Label>
                <Input
                  type="number"
                  value={targetSize}
                  onChange={(e) => setTargetSize(Number(e.target.value))}
                />
              </div>
              <div>
                <Label className="text-xs">Lift Esperado (%)</Label>
                <Input
                  type="number"
                  value={expectedLift}
                  onChange={(e) => setExpectedLift(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-2 rounded-lg bg-muted/50 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Conversiones proyectadas
                </span>
                <span className="font-display font-bold">
                  {projectedConversions}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Ingreso proyectado
                </span>
                <span className="font-display font-bold text-emerald-600">
                  ₡{(projectedRevenue / 1_000_000).toFixed(1)}M
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">ROI</span>
                <span
                  className={`font-display text-lg font-bold ${
                    projectedROI >= 0 ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {projectedROI}%
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Punto de equilibrio</span>
                <span className="font-display font-bold">
                  {breakEven} conversiones
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* A/B Test Suggestions */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg">
            Sugerencias de Pruebas A/B
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "WhatsApp vs Email para Fríos",
                hypothesis:
                  "WhatsApp tendrá 2x mayor tasa de respuesta que email para leads fríos",
                metric: "Tasa de respuesta a 48h",
                audience: `${Math.round(coldLeads.length / 2)} leads por grupo`,
              },
              {
                title: "Llamada temprana vs tardía",
                hypothesis:
                  "Llamadas antes de las 10am tendrán mayor tasa de contacto",
                metric: "Tasa de contacto efectivo",
                audience: "Leads calientes nuevos",
              },
              {
                title: "Cotización inmediata vs nurturing",
                hypothesis:
                  "Enviar cotización en primer contacto vs. secuencia de 3 toques",
                metric: "Tasa de conversión a 30 días",
                audience: "Leads calificados",
              },
            ].map((test) => (
              <div
                key={test.title}
                className="rounded-lg border border-border p-4 space-y-2"
              >
                <h4 className="text-sm font-semibold">{test.title}</h4>
                <p className="text-xs text-muted-foreground">
                  {test.hypothesis}
                </p>
                <div className="flex flex-col gap-1 text-xs">
                  <span>
                    <strong>Métrica:</strong> {test.metric}
                  </span>
                  <span>
                    <strong>Audiencia:</strong> {test.audience}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
