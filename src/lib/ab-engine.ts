/**
 * A/B Test Recommendation Engine
 * Generates contextual A/B test proposals based on real lead data,
 * funnel stage distribution, and conversion patterns.
 * Covers: Conversion, Reactivation, Retention campaigns.
 */
import type { ECSLead } from "@/types/ecs";

export type ABCategory = "conversion" | "reactivation" | "retention";

export interface ABTest {
  id: string;
  category: ABCategory;
  title: string;
  hypothesis: string;
  variantA: string;
  variantB: string;
  metric: string;
  targetSegment: string;
  funnelStage: string;
  estimatedImpact: "alto" | "medio" | "bajo";
  priority: number; // 1-10
  sampleSize: number;
  durationDays: number;
  channel: string;
}

// ─── Funnel stats from real data ───
interface FunnelStats {
  total: number;
  byStatus: Record<string, number>;
  bySegment: Record<string, number>;
  avgScore: number;
  hotLeads: number;
  dormantLeads: number;
  lostLeads: number;
  withEmail: number;
  withPhone: number;
  withBudget: number;
  recentActive: number; // active in last 30 days
  channels: Record<string, number>;
}

function computeFunnelStats(leads: ECSLead[]): FunnelStats {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 86400000;
  const stats: FunnelStats = {
    total: leads.length,
    byStatus: {},
    bySegment: {},
    avgScore: 0,
    hotLeads: 0,
    dormantLeads: 0,
    lostLeads: 0,
    withEmail: 0,
    withPhone: 0,
    withBudget: 0,
    recentActive: 0,
    channels: {},
  };

  let scoreSum = 0;
  for (const l of leads) {
    stats.byStatus[l.status] = (stats.byStatus[l.status] || 0) + 1;
    stats.bySegment[l.segment] = (stats.bySegment[l.segment] || 0) + 1;
    scoreSum += l.current_score;
    if (l.segment === "hot") stats.hotLeads++;
    if (l.segment === "dormant") stats.dormantLeads++;
    if (l.status === "lost") stats.lostLeads++;
    if (l.email) stats.withEmail++;
    if (l.phone) stats.withPhone++;
    if (l.budget_range) stats.withBudget++;
    if (l.last_interaction_at && new Date(l.last_interaction_at).getTime() > thirtyDaysAgo) stats.recentActive++;
    for (const ch of l.channels ?? []) {
      stats.channels[ch] = (stats.channels[ch] || 0) + 1;
    }
  }
  stats.avgScore = leads.length > 0 ? Math.round(scoreSum / leads.length) : 0;
  return stats;
}

// ─── Conversion A/B Test Templates ───
const CONVERSION_TEMPLATES: Omit<ABTest, "id" | "sampleSize" | "priority">[] = [
  {
    category: "conversion",
    title: "Tiempo de respuesta: 1h vs 24h",
    hypothesis: "Responder en menos de 1 hora aumenta la tasa de conversión de leads nuevos vs responder en 24h",
    variantA: "Respuesta automática + llamada dentro de 1 hora",
    variantB: "Flujo actual: respuesta dentro de 24 horas",
    metric: "Tasa de conversión lead → contactado (%)",
    targetSegment: "Leads nuevos (status: new)",
    funnelStage: "New → Contacted",
    estimatedImpact: "alto",
    durationDays: 14,
    channel: "Multi-canal",
  },
  {
    category: "conversion",
    title: "WhatsApp primero vs Email primero",
    hypothesis: "El primer contacto por WhatsApp genera más engagement que por email en leads con teléfono",
    variantA: "Primer contacto por WhatsApp con mensaje personalizado",
    variantB: "Primer contacto por email con plantilla estándar",
    metric: "Tasa de respuesta en primeras 48h (%)",
    targetSegment: "Leads con teléfono y email",
    funnelStage: "New → Contacted",
    estimatedImpact: "alto",
    durationDays: 14,
    channel: "WhatsApp vs Email",
  },
  {
    category: "conversion",
    title: "Cotización inmediata vs Consulta de diseño",
    hypothesis: "Ofrecer consulta de diseño gratuita convierte mejor que enviar cotización directa",
    variantA: "Invitación a consulta de diseño personalizada gratuita",
    variantB: "Envío de cotización estimada basada en el proyecto",
    metric: "Tasa de avance a etapa Qualified (%)",
    targetSegment: "Leads contactados con proyecto definido",
    funnelStage: "Contacted → Qualified",
    estimatedImpact: "medio",
    durationDays: 21,
    channel: "Email + WhatsApp",
  },
  {
    category: "conversion",
    title: "Video showroom virtual vs Fotos de catálogo",
    hypothesis: "Un video tour del showroom genera más visitas presenciales que fotos estáticas",
    variantA: "Video personalizado del showroom con productos relevantes",
    variantB: "Catálogo PDF con fotos de productos similares",
    metric: "Tasa de visita a showroom (%)",
    targetSegment: "Leads en etapa Qualified",
    funnelStage: "Qualified → Proposal",
    estimatedImpact: "medio",
    durationDays: 21,
    channel: "WhatsApp + Email",
  },
  {
    category: "conversion",
    title: "Descuento por cierre rápido vs Valor agregado",
    hypothesis: "Ofrecer un upgrade gratuito convierte mejor que un descuento directo en precio",
    variantA: "Upgrade gratuito: acabado premium o accesorio extra",
    variantB: "Descuento del 5% por cierre dentro de 7 días",
    metric: "Tasa de cierre en 7 días (%)",
    targetSegment: "Leads en etapa Proposal/Negotiation",
    funnelStage: "Proposal → Won",
    estimatedImpact: "alto",
    durationDays: 14,
    channel: "Llamada + Email",
  },
  {
    category: "conversion",
    title: "Seguimiento 3 días vs 7 días",
    hypothesis: "Seguimiento cada 3 días mantiene el momentum mejor que cada 7 días",
    variantA: "Cadencia de seguimiento cada 3 días (llamada/WhatsApp alternado)",
    variantB: "Cadencia de seguimiento cada 7 días (email + llamada)",
    metric: "Tasa de avance de etapa en 30 días (%)",
    targetSegment: "Leads activos en cualquier etapa",
    funnelStage: "Cualquier etapa → Siguiente",
    estimatedImpact: "medio",
    durationDays: 30,
    channel: "Multi-canal",
  },
  {
    category: "conversion",
    title: "Asignación por especialidad vs Round-robin",
    hypothesis: "Asignar leads por tipo de proyecto al vendedor especialista mejora la conversión",
    variantA: "Asignación por especialidad (cocinas→experto cocinas, closets→experto closets)",
    variantB: "Asignación round-robin al siguiente vendedor disponible",
    metric: "Tasa de conversión lead → deal (%)",
    targetSegment: "Todos los leads nuevos",
    funnelStage: "New → Qualified",
    estimatedImpact: "medio",
    durationDays: 30,
    channel: "Interno",
  },
  {
    category: "conversion",
    title: "Landing personalizada vs Landing genérica",
    hypothesis: "Una landing page personalizada por tipo de proyecto aumenta la tasa de cotización",
    variantA: "Landing con renders 3D del tipo de proyecto del lead",
    variantB: "Landing genérica con portafolio general",
    metric: "Tasa de solicitud de cotización (%)",
    targetSegment: "Leads de Facebook/Web con proyecto definido",
    funnelStage: "New → Contacted",
    estimatedImpact: "alto",
    durationDays: 21,
    channel: "Web + Facebook Ads",
  },
  {
    category: "conversion",
    title: "Testimonial de cliente similar vs Sin testimonial",
    hypothesis: "Incluir un caso de éxito similar al proyecto del lead aumenta la confianza y conversión",
    variantA: "Email con video testimonial de cliente con proyecto similar",
    variantB: "Email estándar de seguimiento sin testimonial",
    metric: "Tasa de respuesta positiva (%)",
    targetSegment: "Leads en etapa Contacted/Qualified",
    funnelStage: "Contacted → Qualified",
    estimatedImpact: "medio",
    durationDays: 14,
    channel: "Email",
  },
  {
    category: "conversion",
    title: "Propuesta con financiamiento vs Sin financiamiento",
    hypothesis: "Mostrar opciones de financiamiento en la propuesta reduce la objeción de precio",
    variantA: "Propuesta con 3 opciones de financiamiento (6, 12, 24 meses)",
    variantB: "Propuesta con precio de contado únicamente",
    metric: "Tasa de aceptación de propuesta (%)",
    targetSegment: "Leads en etapa Proposal con monto > $5,000",
    funnelStage: "Proposal → Won",
    estimatedImpact: "alto",
    durationDays: 30,
    channel: "Email + Presencial",
  },
  {
    category: "conversion",
    title: "Llamada de calificación vs Formulario web",
    hypothesis: "Una llamada de calificación de 5 min genera leads más calificados que un formulario largo",
    variantA: "Llamada de calificación de 5 minutos con script estructurado",
    variantB: "Formulario web de 8 preguntas de calificación",
    metric: "Tasa de leads calificados (%)",
    targetSegment: "Leads nuevos de campañas digitales",
    funnelStage: "New → Qualified",
    estimatedImpact: "medio",
    durationDays: 21,
    channel: "Teléfono vs Web",
  },
  {
    category: "conversion",
    title: "Visita showroom con cita vs Walk-in",
    hypothesis: "Leads que agendan cita previa tienen mayor tasa de cierre que walk-ins",
    variantA: "Invitación a cita personalizada con agenda de 45 min",
    variantB: "Invitación abierta a visitar showroom cuando deseen",
    metric: "Tasa de cierre post-visita (%)",
    targetSegment: "Leads calificados sin visita a showroom",
    funnelStage: "Qualified → Proposal",
    estimatedImpact: "alto",
    durationDays: 30,
    channel: "WhatsApp + Llamada",
  },
];

// ─── Reactivation A/B Test Templates ───
const REACTIVATION_TEMPLATES: Omit<ABTest, "id" | "sampleSize" | "priority">[] = [
  {
    category: "reactivation",
    title: "Oferta exclusiva vs Contenido de valor",
    hypothesis: "Una oferta exclusiva reactiva más leads dormidos que contenido educativo",
    variantA: "Email con oferta exclusiva: 10% descuento válido 7 días",
    variantB: "Email con guía de tendencias de diseño 2026",
    metric: "Tasa de reapertura de conversación (%)",
    targetSegment: "Leads dormidos (>60 días sin actividad)",
    funnelStage: "Dormant → Contacted",
    estimatedImpact: "alto",
    durationDays: 14,
    channel: "Email",
  },
  {
    category: "reactivation",
    title: "WhatsApp personal vs Email masivo",
    hypothesis: "Un WhatsApp personalizado del vendedor original reactiva mejor que un email genérico",
    variantA: "WhatsApp personal del vendedor: '¡Hola [nombre]! ¿Cómo va tu proyecto?'",
    variantB: "Email automatizado con novedades de la empresa",
    metric: "Tasa de respuesta en 7 días (%)",
    targetSegment: "Leads inactivos 30-90 días con teléfono",
    funnelStage: "Cold → Contacted",
    estimatedImpact: "alto",
    durationDays: 7,
    channel: "WhatsApp vs Email",
  },
  {
    category: "reactivation",
    title: "Evento presencial vs Webinar virtual",
    hypothesis: "Invitar a un evento presencial en showroom reactiva más leads que un webinar",
    variantA: "Invitación a evento exclusivo en showroom con cóctel",
    variantB: "Invitación a webinar virtual de tendencias de diseño",
    metric: "Tasa de asistencia y re-engagement (%)",
    targetSegment: "Leads perdidos con presupuesto definido",
    funnelStage: "Lost → Contacted",
    estimatedImpact: "medio",
    durationDays: 21,
    channel: "Email + WhatsApp",
  },
  {
    category: "reactivation",
    title: "Encuesta de satisfacción vs Oferta directa",
    hypothesis: "Preguntar por qué no avanzaron genera más re-engagement que una oferta directa",
    variantA: "Encuesta corta: '¿Qué podemos mejorar?' + incentivo por completar",
    variantB: "Oferta directa: 'Tenemos algo especial para ti'",
    metric: "Tasa de respuesta y calidad de feedback (%)",
    targetSegment: "Leads perdidos en últimos 90 días",
    funnelStage: "Lost → Contacted",
    estimatedImpact: "medio",
    durationDays: 14,
    channel: "Email",
  },
  {
    category: "reactivation",
    title: "Secuencia 3 emails vs Email único",
    hypothesis: "Una secuencia de 3 emails espaciados reactiva más que un solo email de reactivación",
    variantA: "Secuencia: Día 1 (valor) → Día 4 (caso éxito) → Día 7 (oferta)",
    variantB: "Email único con oferta + caso de éxito + CTA",
    metric: "Tasa de reactivación acumulada en 14 días (%)",
    targetSegment: "Leads dormidos con email válido",
    funnelStage: "Dormant → Contacted",
    estimatedImpact: "medio",
    durationDays: 14,
    channel: "Email",
  },
  {
    category: "reactivation",
    title: "Nuevo producto/servicio vs Recordatorio de proyecto",
    hypothesis: "Presentar un nuevo producto genera más interés que recordar el proyecto original",
    variantA: "Presentación de nueva línea de productos / acabados",
    variantB: "Recordatorio personalizado del proyecto que consultaron",
    metric: "Tasa de clic y respuesta (%)",
    targetSegment: "Leads fríos con proyecto definido",
    funnelStage: "Cold → Warm",
    estimatedImpact: "medio",
    durationDays: 14,
    channel: "Email + WhatsApp",
  },
  {
    category: "reactivation",
    title: "Retargeting Facebook vs Google Display",
    hypothesis: "Retargeting en Facebook genera más re-visitas que Google Display para leads inactivos",
    variantA: "Campaña Facebook retargeting con carrusel de proyectos",
    variantB: "Campaña Google Display con banner de oferta",
    metric: "Tasa de re-visita al sitio web (%)",
    targetSegment: "Leads con UTM source de campañas digitales",
    funnelStage: "Dormant → Warm",
    estimatedImpact: "medio",
    durationDays: 21,
    channel: "Facebook vs Google",
  },
  {
    category: "reactivation",
    title: "Llamada de cortesía vs SMS automático",
    hypothesis: "Una llamada personal de cortesía reactiva mejor que un SMS automatizado",
    variantA: "Llamada de 2 min: 'Queríamos saber cómo va su proyecto'",
    variantB: "SMS: 'Tenemos novedades para su proyecto. Responda SI para más info'",
    metric: "Tasa de reactivación en 7 días (%)",
    targetSegment: "Leads inactivos 30-60 días con teléfono",
    funnelStage: "Cold → Contacted",
    estimatedImpact: "alto",
    durationDays: 7,
    channel: "Teléfono vs SMS",
  },
];

// ─── Retention A/B Test Templates ───
const RETENTION_TEMPLATES: Omit<ABTest, "id" | "sampleSize" | "priority">[] = [
  {
    category: "retention",
    title: "Programa de referidos vs Sin programa",
    hypothesis: "Un programa de referidos con incentivo genera más leads de calidad de clientes existentes",
    variantA: "Programa: 'Refiere a un amigo y ambos reciben 5% de descuento'",
    variantB: "Sin programa de referidos (flujo actual)",
    metric: "Leads referidos por cliente y tasa de conversión (%)",
    targetSegment: "Clientes ganados (status: won)",
    funnelStage: "Won → Referral",
    estimatedImpact: "alto",
    durationDays: 60,
    channel: "Email + WhatsApp",
  },
  {
    category: "retention",
    title: "Follow-up post-venta 7 días vs 30 días",
    hypothesis: "Un follow-up a los 7 días post-entrega genera más satisfacción que a los 30 días",
    variantA: "Llamada de satisfacción a los 7 días + encuesta NPS",
    variantB: "Email de satisfacción a los 30 días + encuesta NPS",
    metric: "NPS score y tasa de respuesta (%)",
    targetSegment: "Clientes con entrega reciente",
    funnelStage: "Won → Retained",
    estimatedImpact: "medio",
    durationDays: 30,
    channel: "Llamada vs Email",
  },
  {
    category: "retention",
    title: "Mantenimiento preventivo vs Sin contacto",
    hypothesis: "Ofrecer servicio de mantenimiento preventivo aumenta la recompra y referidos",
    variantA: "Oferta de mantenimiento preventivo gratuito al año de la compra",
    variantB: "Sin contacto post-venta después de la entrega",
    metric: "Tasa de recompra y referidos en 12 meses (%)",
    targetSegment: "Clientes con compra hace 6-12 meses",
    funnelStage: "Won → Upsell",
    estimatedImpact: "alto",
    durationDays: 90,
    channel: "WhatsApp + Email",
  },
  {
    category: "retention",
    title: "Newsletter mensual vs Contacto trimestral",
    hypothesis: "Un newsletter mensual con tips mantiene la marca top-of-mind vs contacto trimestral",
    variantA: "Newsletter mensual: tips de cuidado, tendencias, proyectos destacados",
    variantB: "Email trimestral con resumen de novedades",
    metric: "Tasa de apertura y engagement (%)",
    targetSegment: "Todos los clientes ganados",
    funnelStage: "Won → Retained",
    estimatedImpact: "bajo",
    durationDays: 90,
    channel: "Email",
  },
  {
    category: "retention",
    title: "Upsell complementario vs Cross-sell nueva categoría",
    hypothesis: "Ofrecer un producto complementario convierte mejor que una categoría nueva",
    variantA: "Upsell: 'Completa tu cocina con una isla/barra' (complementario)",
    variantB: "Cross-sell: 'Conoce nuestra línea de closets' (nueva categoría)",
    metric: "Tasa de conversión de upsell/cross-sell (%)",
    targetSegment: "Clientes ganados con compra > $3,000",
    funnelStage: "Won → Upsell",
    estimatedImpact: "medio",
    durationDays: 30,
    channel: "Email + WhatsApp",
  },
  {
    category: "retention",
    title: "Evento VIP exclusivo vs Descuento de lealtad",
    hypothesis: "Un evento VIP genera más lealtad y referidos que un descuento directo",
    variantA: "Invitación a evento VIP: preview de nueva colección + cena",
    variantB: "Cupón de 8% de descuento para próxima compra",
    metric: "Tasa de asistencia/uso y referidos generados",
    targetSegment: "Clientes top (compra > $10,000)",
    funnelStage: "Won → Advocate",
    estimatedImpact: "alto",
    durationDays: 30,
    channel: "Email + Llamada",
  },
];

// ─── Generate A/B tests based on real data ───
export function generateABTests(
  leads: ECSLead[],
  category: ABCategory | "all",
  count = 10,
  seed?: number
): ABTest[] {
  const stats = computeFunnelStats(leads);
  const rng = seededRandom(seed ?? Date.now());

  let templates: Omit<ABTest, "id" | "sampleSize" | "priority">[];

  if (category === "all") {
    templates = [...CONVERSION_TEMPLATES, ...REACTIVATION_TEMPLATES, ...RETENTION_TEMPLATES];
  } else if (category === "conversion") {
    templates = [...CONVERSION_TEMPLATES];
  } else if (category === "reactivation") {
    templates = [...REACTIVATION_TEMPLATES];
  } else {
    templates = [...RETENTION_TEMPLATES];
  }

  // Shuffle with seeded random
  for (let i = templates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [templates[i], templates[j]] = [templates[j], templates[i]];
  }

  // Pick top N
  const selected = templates.slice(0, count);

  return selected.map((t, idx) => {
    // Calculate contextual sample size based on target segment
    let sampleSize = Math.min(200, Math.floor(stats.total * 0.05));
    if (t.targetSegment.includes("dormido") || t.targetSegment.includes("Dormant")) {
      sampleSize = Math.min(sampleSize, stats.dormantLeads);
    } else if (t.targetSegment.includes("perdido") || t.targetSegment.includes("Lost")) {
      sampleSize = Math.min(sampleSize, stats.lostLeads);
    } else if (t.targetSegment.includes("ganado") || t.targetSegment.includes("Won") || t.targetSegment.includes("won")) {
      sampleSize = Math.min(sampleSize, stats.byStatus["won"] || 50);
    }
    sampleSize = Math.max(20, sampleSize);

    // Priority based on estimated impact and funnel position
    let priority = 5;
    if (t.estimatedImpact === "alto") priority += 3;
    else if (t.estimatedImpact === "medio") priority += 1;
    // Boost priority for stages with more leads
    if (t.funnelStage.includes("New") && (stats.byStatus["new"] || 0) > 100) priority += 1;
    if (t.funnelStage.includes("Dormant") && stats.dormantLeads > 1000) priority += 1;
    priority = Math.min(10, priority);

    return {
      ...t,
      id: `ab-${category}-${idx}-${Math.floor(rng() * 10000)}`,
      sampleSize,
      priority,
    };
  });
}

// ─── Lead Recommendation for a specific A/B Test ───
// Scores each lead by how much they'd benefit from this test

export interface RecommendedLead {
  lead: ECSLead;
  fitScore: number; // 0-100
  reasons: string[];
}

export function recommendLeadsForTest(
  test: ABTest,
  leads: ECSLead[],
  maxResults = 50
): RecommendedLead[] {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 86400000;
  const sixtyDaysAgo = now - 60 * 86400000;

  const scored: RecommendedLead[] = [];

  for (const lead of leads) {
    let fitScore = 0;
    const reasons: string[] = [];
    const lastActive = lead.last_interaction_at ? new Date(lead.last_interaction_at).getTime() : 0;

    // ─── Category-level matching ───
    if (test.category === "conversion") {
      // Prefer leads that are NOT won/lost — still in the funnel
      if (["new", "contacted", "qualified", "proposal", "negotiation"].includes(lead.status)) {
        fitScore += 20;
        reasons.push("Lead activo en el funnel");
      }
      // Score-based: mid-range leads benefit most from conversion tactics
      if (lead.current_score >= 30 && lead.current_score <= 70) {
        fitScore += 15;
        reasons.push(`Score medio (${lead.current_score}) — mayor potencial de mejora`);
      }
    } else if (test.category === "reactivation") {
      // Prefer dormant/cold/lost leads
      if (["dormant", "lost"].includes(lead.segment) || lead.status === "lost") {
        fitScore += 25;
        reasons.push("Lead dormido/perdido — candidato ideal para reactivación");
      }
      if (lastActive && lastActive < sixtyDaysAgo) {
        fitScore += 15;
        reasons.push("Sin actividad en >60 días");
      }
      if (lead.current_score < 30) {
        fitScore += 10;
        reasons.push("Score bajo — oportunidad de recuperación");
      }
    } else if (test.category === "retention") {
      // Prefer won leads
      if (lead.status === "won") {
        fitScore += 30;
        reasons.push("Cliente ganado — candidato para fidelización");
      }
      if (lead.current_score >= 60) {
        fitScore += 10;
        reasons.push("Score alto — alto valor para retener");
      }
    }

    // ─── Funnel stage matching ───
    const stage = test.funnelStage.toLowerCase();
    if (stage.includes("new") && lead.status === "new") {
      fitScore += 15;
      reasons.push("Coincide con etapa: New");
    }
    if (stage.includes("contacted") && lead.status === "contacted") {
      fitScore += 15;
      reasons.push("Coincide con etapa: Contacted");
    }
    if (stage.includes("qualified") && lead.status === "qualified") {
      fitScore += 15;
      reasons.push("Coincide con etapa: Qualified");
    }
    if (stage.includes("proposal") && lead.status === "proposal") {
      fitScore += 15;
      reasons.push("Coincide con etapa: Proposal");
    }
    if ((stage.includes("dormant") || stage.includes("cold")) && ["dormant", "cold"].includes(lead.segment)) {
      fitScore += 15;
      reasons.push("Coincide con segmento dormido/frío");
    }
    if (stage.includes("lost") && lead.status === "lost") {
      fitScore += 15;
      reasons.push("Coincide con etapa: Lost");
    }
    if (stage.includes("won") && lead.status === "won") {
      fitScore += 15;
      reasons.push("Coincide con etapa: Won");
    }

    // ─── Channel matching ───
    const ch = test.channel.toLowerCase();
    const leadChannels = (lead.channels ?? []).map((c) => c.toLowerCase());
    if (ch.includes("whatsapp") && (lead.phone || leadChannels.some((c) => c.includes("whatsapp")))) {
      fitScore += 10;
      reasons.push("Tiene teléfono/WhatsApp — canal compatible");
    }
    if (ch.includes("email") && lead.email) {
      fitScore += 10;
      reasons.push("Tiene email — canal compatible");
    }
    if (ch.includes("llamada") || ch.includes("teléfono")) {
      if (lead.phone) {
        fitScore += 10;
        reasons.push("Tiene teléfono — canal compatible");
      }
    }

    // ─── Recency bonus ───
    if (lastActive && lastActive > thirtyDaysAgo && test.category !== "reactivation") {
      fitScore += 5;
      reasons.push("Actividad reciente (<30 días)");
    }

    // ─── Interaction volume ───
    if (lead.interaction_count >= 3 && lead.interaction_count <= 15) {
      fitScore += 5;
      reasons.push("Volumen de interacciones moderado");
    }

    // ─── Budget indicator ───
    if (lead.budget_range && (test.funnelStage.includes("Proposal") || test.funnelStage.includes("Won"))) {
      fitScore += 5;
      reasons.push("Tiene presupuesto definido");
    }

    // Only include leads with some relevance
    if (fitScore >= 15) {
      scored.push({ lead, fitScore: Math.min(100, fitScore), reasons });
    }
  }

  // Sort by fitScore descending, take top N
  scored.sort((a, b) => b.fitScore - a.fitScore);
  return scored.slice(0, maxResults);
}

// Simple seeded PRNG (mulberry32)
function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
