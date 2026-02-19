/**
 * Cookbook Engine — generates and manages step-by-step execution plans
 * for A/B test experiments. Each step has a concrete action that can be
 * executed via Meta, WhatsApp, Bitrix, AI content generation, or manually.
 */
import type { Experiment } from "@/stores/useExperimentStore";

// ─── Action types ───

export type CookbookActionType =
  | "meta_post"          // Publish/promote a post on Meta (FB/IG)
  | "meta_ad"            // Create/update a Meta ad
  | "ai_generate"        // Generate content with AI (copy, image prompt, etc.)
  | "whatsapp_send"      // Send message(s) via WhatsApp Manager
  | "whatsapp_template"  // Send templated WhatsApp blast
  | "bitrix_update"      // Update lead status/fields in Bitrix
  | "bitrix_task"        // Create a task in Bitrix for an employee
  | "email_send"         // Send email (manual or template)
  | "schedule_call"      // Schedule follow-up calls
  | "manual"             // Manual action (human must do it)
  | "checkpoint";        // Checkpoint: review metrics before proceeding

export type CookbookStepStatus = "pending" | "in_progress" | "done" | "skipped" | "failed";

export interface CookbookStep {
  id: string;
  order: number;
  title: string;
  description: string;
  actionType: CookbookActionType;
  status: CookbookStepStatus;
  variant: "A" | "B" | "both";
  // Payload for execution
  payload: CookbookPayload;
  // Execution metadata
  executedAt?: string;
  executedBy?: string;
  result?: string;
  // Dependencies
  dependsOn?: string[]; // step IDs that must be done first
  // Timing
  dayOffset: number; // day of the experiment when this should happen
  isRepeating?: boolean;
  repeatIntervalDays?: number;
}

export type CookbookPayload =
  | MetaPostPayload
  | MetaAdPayload
  | AIGeneratePayload
  | WhatsAppSendPayload
  | BitrixUpdatePayload
  | BitrixTaskPayload
  | EmailPayload
  | ScheduleCallPayload
  | ManualPayload
  | CheckpointPayload;

export interface MetaPostPayload {
  type: "meta_post";
  message: string;
  imagePrompt?: string;
  targetAudience?: string;
  budget?: number;
  scheduledTime?: string;
}

export interface MetaAdPayload {
  type: "meta_ad";
  campaignName: string;
  adSetName: string;
  objective: string;
  dailyBudget: number;
  duration: number;
  creative: { headline: string; body: string; cta: string };
  targetAudience: string;
}

export interface AIGeneratePayload {
  type: "ai_generate";
  prompt: string;
  contentType: "post_copy" | "ad_copy" | "email_template" | "whatsapp_message" | "image_prompt" | "landing_copy";
  context: string;
  generatedContent?: string;
}

export interface WhatsAppSendPayload {
  type: "whatsapp_send";
  messageTemplate: string;
  targetLeadIds: string[];
  personalize: boolean;
  variables?: Record<string, string>;
}

export interface BitrixUpdatePayload {
  type: "bitrix_update";
  leadIds: string[];
  fieldsToUpdate: Record<string, string>;
  reason: string;
}

export interface BitrixTaskPayload {
  type: "bitrix_task";
  taskTitle: string;
  taskDescription: string;
  assignTo: string;
  dueInDays: number;
}

export interface EmailPayload {
  type: "email_send";
  subject: string;
  bodyTemplate: string;
  targetLeadIds: string[];
}

export interface ScheduleCallPayload {
  type: "schedule_call";
  targetLeadIds: string[];
  script: string;
  callDurationMinutes: number;
  assignTo?: string;
}

export interface ManualPayload {
  type: "manual";
  instructions: string;
  checklist: string[];
}

export interface CheckpointPayload {
  type: "checkpoint";
  metricsToReview: string[];
  successCriteria: string;
  decisionOptions: string[];
}

// ─── Cookbook (the full plan) ───

export interface Cookbook {
  id: string;
  experimentId: string;
  title: string;
  description: string;
  steps: CookbookStep[];
  createdAt: string;
  updatedAt: string;
}

// ─── Action type config ───

export const ACTION_TYPE_CONFIG: Record<CookbookActionType, {
  label: string;
  emoji: string;
  color: string;
  bgColor: string;
}> = {
  meta_post:          { label: "Publicar en Meta",       emoji: "📱", color: "text-blue-700",    bgColor: "bg-blue-50 dark:bg-blue-950/30" },
  meta_ad:            { label: "Crear Anuncio Meta",     emoji: "📣", color: "text-indigo-700",  bgColor: "bg-indigo-50 dark:bg-indigo-950/30" },
  ai_generate:        { label: "Generar con IA",         emoji: "✨", color: "text-purple-700",  bgColor: "bg-purple-50 dark:bg-purple-950/30" },
  whatsapp_send:      { label: "Enviar WhatsApp",        emoji: "💬", color: "text-green-700",   bgColor: "bg-green-50 dark:bg-green-950/30" },
  whatsapp_template:  { label: "Blast WhatsApp",         emoji: "📨", color: "text-emerald-700", bgColor: "bg-emerald-50 dark:bg-emerald-950/30" },
  bitrix_update:      { label: "Actualizar Bitrix",      emoji: "🔄", color: "text-orange-700",  bgColor: "bg-orange-50 dark:bg-orange-950/30" },
  bitrix_task:        { label: "Tarea en Bitrix",        emoji: "📋", color: "text-amber-700",   bgColor: "bg-amber-50 dark:bg-amber-950/30" },
  email_send:         { label: "Enviar Email",           emoji: "📧", color: "text-cyan-700",    bgColor: "bg-cyan-50 dark:bg-cyan-950/30" },
  schedule_call:      { label: "Agendar Llamada",        emoji: "📞", color: "text-teal-700",    bgColor: "bg-teal-50 dark:bg-teal-950/30" },
  manual:             { label: "Acción Manual",          emoji: "👤", color: "text-slate-700",   bgColor: "bg-slate-50 dark:bg-slate-950/30" },
  checkpoint:         { label: "Checkpoint",             emoji: "🔍", color: "text-rose-700",    bgColor: "bg-rose-50 dark:bg-rose-950/30" },
};

export const STEP_STATUS_CONFIG: Record<CookbookStepStatus, {
  label: string;
  color: string;
}> = {
  pending:     { label: "Pendiente",    color: "text-muted-foreground" },
  in_progress: { label: "En Progreso",  color: "text-amber-600" },
  done:        { label: "Completado",   color: "text-emerald-600" },
  skipped:     { label: "Omitido",      color: "text-slate-400" },
  failed:      { label: "Fallido",      color: "text-red-600" },
};

// ─── Cookbook Generator ───

let _stepId = 0;
function stepId(): string {
  return `step-${++_stepId}-${Math.random().toString(36).slice(2, 6)}`;
}

export function generateCookbook(experiment: Experiment): Cookbook {
  _stepId = 0;
  const { test } = experiment;
  const variantALeads = experiment.leads.filter((l) => l.variant === "A").map((l) => l.leadId);
  const variantBLeads = experiment.leads.filter((l) => l.variant === "B").map((l) => l.leadId);

  const steps: CookbookStep[] = [];
  const channel = test.channel.toLowerCase();
  const isWhatsApp = channel.includes("whatsapp");
  const isEmail = channel.includes("email");
  const isPhone = channel.includes("llamada") || channel.includes("teléfono");
  const isMeta = channel.includes("facebook") || channel.includes("meta") || channel.includes("web");
  const isMulti = channel.includes("multi");

  // ── PHASE 1: Setup (Day 0) ──

  // Step 1: AI generates content for both variants
  steps.push({
    id: stepId(), order: steps.length + 1,
    title: "Generar contenido Variante A con IA",
    description: `Usar IA para crear el contenido/mensaje de la Variante A: "${test.variantA}"`,
    actionType: "ai_generate",
    status: "pending",
    variant: "A",
    dayOffset: 0,
    payload: {
      type: "ai_generate",
      prompt: `Genera el contenido para una prueba A/B de ${test.category}. 
Variante A (Tratamiento): ${test.variantA}
Contexto: ${test.hypothesis}
Segmento objetivo: ${test.targetSegment}
Canal: ${test.channel}
Escribe en español, tono profesional pero cercano, para ARA Group (cocinas y muebles premium en Costa Rica).`,
      contentType: isEmail ? "email_template" : isWhatsApp ? "whatsapp_message" : "post_copy",
      context: test.variantA,
    },
  });

  steps.push({
    id: stepId(), order: steps.length + 1,
    title: "Generar contenido Variante B con IA",
    description: `Usar IA para crear el contenido/mensaje de la Variante B: "${test.variantB}"`,
    actionType: "ai_generate",
    status: "pending",
    variant: "B",
    dayOffset: 0,
    payload: {
      type: "ai_generate",
      prompt: `Genera el contenido para una prueba A/B de ${test.category}. 
Variante B (Control): ${test.variantB}
Contexto: ${test.hypothesis}
Segmento objetivo: ${test.targetSegment}
Canal: ${test.channel}
Escribe en español, tono profesional pero cercano, para ARA Group (cocinas y muebles premium en Costa Rica).`,
      contentType: isEmail ? "email_template" : isWhatsApp ? "whatsapp_message" : "post_copy",
      context: test.variantB,
    },
  });

  // Step 2: Tag/segment leads in Bitrix
  steps.push({
    id: stepId(), order: steps.length + 1,
    title: "Etiquetar leads en Bitrix — Variante A",
    description: `Marcar ${variantALeads.length} leads como participantes de Variante A en Bitrix CRM`,
    actionType: "bitrix_update",
    status: "pending",
    variant: "A",
    dayOffset: 0,
    payload: {
      type: "bitrix_update",
      leadIds: variantALeads,
      fieldsToUpdate: {
        "UF_AB_TEST": experiment.id,
        "UF_AB_VARIANT": "A",
        "UF_AB_TEST_NAME": test.title,
      },
      reason: `Inscribir en prueba A/B: ${test.title} — Variante A`,
    },
  });

  steps.push({
    id: stepId(), order: steps.length + 1,
    title: "Etiquetar leads en Bitrix — Variante B",
    description: `Marcar ${variantBLeads.length} leads como participantes de Variante B en Bitrix CRM`,
    actionType: "bitrix_update",
    status: "pending",
    variant: "B",
    dayOffset: 0,
    payload: {
      type: "bitrix_update",
      leadIds: variantBLeads,
      fieldsToUpdate: {
        "UF_AB_TEST": experiment.id,
        "UF_AB_VARIANT": "B",
        "UF_AB_TEST_NAME": test.title,
      },
      reason: `Inscribir en prueba A/B: ${test.title} — Variante B`,
    },
  });

  // ── PHASE 2: Activation (Day 1) ──

  if (isWhatsApp || isMulti) {
    steps.push({
      id: stepId(), order: steps.length + 1,
      title: "Enviar WhatsApp — Variante A",
      description: `Enviar mensaje WhatsApp personalizado a ${variantALeads.length} leads de Variante A`,
      actionType: "whatsapp_send",
      status: "pending",
      variant: "A",
      dayOffset: 1,
      payload: {
        type: "whatsapp_send",
        messageTemplate: `[Variante A] ${test.variantA} — Personalizar con nombre del lead y detalles del proyecto.`,
        targetLeadIds: variantALeads,
        personalize: true,
      },
    });

    steps.push({
      id: stepId(), order: steps.length + 1,
      title: "Enviar WhatsApp — Variante B",
      description: `Enviar mensaje WhatsApp a ${variantBLeads.length} leads de Variante B`,
      actionType: "whatsapp_send",
      status: "pending",
      variant: "B",
      dayOffset: 1,
      payload: {
        type: "whatsapp_send",
        messageTemplate: `[Variante B] ${test.variantB} — Personalizar con nombre del lead.`,
        targetLeadIds: variantBLeads,
        personalize: true,
      },
    });
  }

  if (isEmail || isMulti) {
    steps.push({
      id: stepId(), order: steps.length + 1,
      title: "Enviar Email — Variante A",
      description: `Enviar email con contenido de Variante A a leads seleccionados`,
      actionType: "email_send",
      status: "pending",
      variant: "A",
      dayOffset: 1,
      payload: {
        type: "email_send",
        subject: `[A/B Test] ${test.title} — Variante A`,
        bodyTemplate: test.variantA,
        targetLeadIds: variantALeads,
      },
    });

    steps.push({
      id: stepId(), order: steps.length + 1,
      title: "Enviar Email — Variante B",
      description: `Enviar email con contenido de Variante B a leads seleccionados`,
      actionType: "email_send",
      status: "pending",
      variant: "B",
      dayOffset: 1,
      payload: {
        type: "email_send",
        subject: `[A/B Test] ${test.title} — Variante B`,
        bodyTemplate: test.variantB,
        targetLeadIds: variantBLeads,
      },
    });
  }

  if (isMeta) {
    steps.push({
      id: stepId(), order: steps.length + 1,
      title: "Publicar en Meta — Variante A",
      description: `Crear publicación/anuncio en Meta con contenido de Variante A`,
      actionType: "meta_post",
      status: "pending",
      variant: "A",
      dayOffset: 1,
      payload: {
        type: "meta_post",
        message: `${test.variantA} — #ARAGroup #CocinasCostaRica`,
        targetAudience: test.targetSegment,
        budget: 15,
      },
    });

    steps.push({
      id: stepId(), order: steps.length + 1,
      title: "Publicar en Meta — Variante B",
      description: `Crear publicación/anuncio en Meta con contenido de Variante B`,
      actionType: "meta_post",
      status: "pending",
      variant: "B",
      dayOffset: 1,
      payload: {
        type: "meta_post",
        message: `${test.variantB} — #ARAGroup #CocinasCostaRica`,
        targetAudience: test.targetSegment,
        budget: 15,
      },
    });
  }

  if (isPhone) {
    steps.push({
      id: stepId(), order: steps.length + 1,
      title: "Agendar llamadas — Variante A",
      description: `Crear tareas de llamada para ${variantALeads.length} leads de Variante A`,
      actionType: "schedule_call",
      status: "pending",
      variant: "A",
      dayOffset: 1,
      payload: {
        type: "schedule_call",
        targetLeadIds: variantALeads,
        script: `Script Variante A: ${test.variantA}`,
        callDurationMinutes: 5,
      },
    });

    steps.push({
      id: stepId(), order: steps.length + 1,
      title: "Agendar llamadas — Variante B",
      description: `Crear tareas de llamada para ${variantBLeads.length} leads de Variante B`,
      actionType: "schedule_call",
      status: "pending",
      variant: "B",
      dayOffset: 1,
      payload: {
        type: "schedule_call",
        targetLeadIds: variantBLeads,
        script: `Script Variante B: ${test.variantB}`,
        callDurationMinutes: 5,
      },
    });
  }

  // ── PHASE 3: Mid-point checkpoint ──

  const midpoint = Math.floor(test.durationDays / 2);
  steps.push({
    id: stepId(), order: steps.length + 1,
    title: `Checkpoint — Día ${midpoint}`,
    description: `Revisar métricas a mitad del experimento. Evaluar si continuar, pausar o ajustar.`,
    actionType: "checkpoint",
    status: "pending",
    variant: "both",
    dayOffset: midpoint,
    payload: {
      type: "checkpoint",
      metricsToReview: [test.metric, "Score ECS promedio", "Cambios de estado", "Tasa de respuesta"],
      successCriteria: `Variante A debe mostrar al menos 5% de mejora sobre Variante B en: ${test.metric}`,
      decisionOptions: [
        "Continuar sin cambios",
        "Aumentar presupuesto de variante ganadora",
        "Pausar variante perdedora",
        "Extender duración del experimento",
        "Detener experimento (resultado claro)",
      ],
    },
  });

  // ── PHASE 4: Follow-up (if multi-touch) ──

  if (test.durationDays >= 14) {
    const followUpDay = Math.min(7, midpoint - 1);

    if (isWhatsApp || isMulti) {
      steps.push({
        id: stepId(), order: steps.length + 1,
        title: "Follow-up WhatsApp — Variante A",
        description: `Segundo contacto WhatsApp para leads que no respondieron en Variante A`,
        actionType: "whatsapp_send",
        status: "pending",
        variant: "A",
        dayOffset: followUpDay,
        payload: {
          type: "whatsapp_send",
          messageTemplate: `Follow-up Variante A: Recordatorio personalizado sobre ${test.variantA}`,
          targetLeadIds: variantALeads,
          personalize: true,
        },
      });
    }

    // Assign Bitrix tasks for human follow-up
    steps.push({
      id: stepId(), order: steps.length + 1,
      title: "Crear tareas de seguimiento en Bitrix",
      description: `Asignar tareas de seguimiento a asesores para leads sin respuesta`,
      actionType: "bitrix_task",
      status: "pending",
      variant: "both",
      dayOffset: followUpDay,
      payload: {
        type: "bitrix_task",
        taskTitle: `Seguimiento A/B Test: ${test.title}`,
        taskDescription: `Contactar leads que no han respondido al día ${followUpDay} del experimento. 
Verificar estado y actualizar en CRM.`,
        assignTo: "Asesor asignado al lead",
        dueInDays: 3,
      },
    });
  }

  // ── PHASE 5: Conclusion ──

  steps.push({
    id: stepId(), order: steps.length + 1,
    title: "Checkpoint Final — Resultados",
    description: `Evaluar resultados finales del experimento y determinar variante ganadora.`,
    actionType: "checkpoint",
    status: "pending",
    variant: "both",
    dayOffset: test.durationDays,
    payload: {
      type: "checkpoint",
      metricsToReview: [
        test.metric,
        "Score ECS promedio por variante",
        "Leads que avanzaron de etapa",
        "Leads que retrocedieron",
        "Tasa de respuesta por variante",
        "ROI estimado por variante",
      ],
      successCriteria: `Diferencia estadísticamente significativa (>10%) entre variantes en: ${test.metric}`,
      decisionOptions: [
        "Escalar Variante A a toda la base",
        "Escalar Variante B a toda la base",
        "Combinar elementos de ambas variantes",
        "Repetir con muestra más grande",
        "Resultado inconcluso — nueva hipótesis",
      ],
    },
  });

  // Scale winning variant
  steps.push({
    id: stepId(), order: steps.length + 1,
    title: "Escalar variante ganadora",
    description: `Aplicar la estrategia ganadora al resto de leads del segmento objetivo.`,
    actionType: "manual",
    status: "pending",
    variant: "both",
    dayOffset: test.durationDays + 1,
    payload: {
      type: "manual",
      instructions: `Basado en los resultados del checkpoint final:
1. Identificar la variante ganadora
2. Crear campaña/flujo con la estrategia ganadora
3. Aplicar a todos los leads de "${test.targetSegment}" no incluidos en el test
4. Documentar aprendizajes en el CRM`,
      checklist: [
        "Revisar métricas finales del experimento",
        "Determinar variante ganadora",
        "Crear nueva campaña/flujo basado en ganadora",
        "Aplicar a segmento completo",
        "Actualizar playbook del equipo",
        "Registrar aprendizajes",
      ],
    },
  });

  // Sort by dayOffset then order
  steps.sort((a, b) => a.dayOffset - b.dayOffset || a.order - b.order);
  // Re-number
  steps.forEach((s, i) => { s.order = i + 1; });

  return {
    id: `cookbook-${experiment.id}`,
    experimentId: experiment.id,
    title: `Cookbook: ${test.title}`,
    description: `Plan de ejecución paso a paso para el experimento "${test.title}" (${test.durationDays} días, ${experiment.leads.length} leads)`,
    steps,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
