/**
 * Signal Normalizer — deterministic semantic deduplication for AI-generated
 * intent signals and risk flags.
 *
 * The sentiment AI agent returns free-form signal names that vary in format:
 *   "showroom_visit", "showroom visit", "Showroom Visit"
 *   "multi-channel presence (phone, showroom, whatsapp)", "multi channel engagement"
 *   "multiple conversations", "multiple conversations same day"
 *
 * This module maps them to canonical keys so counts are not split.
 *
 * Strategy:
 *   1. Lowercase, strip underscores/hyphens, collapse whitespace
 *   2. Match against canonical keyword patterns (longest match wins)
 *   3. If no pattern matches, return the cleaned string as-is
 */

// ─── Intent Signal canonical groups ───
// Each entry: [canonical label, ...keyword patterns that should map to it]
const INTENT_CANONICAL: [string, RegExp][] = [
  // Showroom / visit
  ["visita showroom", /showroom|visita\b.*show|visit/],
  // Stage / pipeline movement
  ["cambio de etapa", /stage.?change|cambio.?etapa|pipeline|stage.?mov/],
  // Budget / financial qualification
  ["presupuesto calificado", /budget.?(qualif|ready|confirm)|presupuesto.?(calific|listo)/],
  // Design request / interest
  ["solicitud de diseño", /design.?(request|interest)|dise[ñn]o.?(solicit|inter)/],
  // Quote / cotización
  ["cotización enviada", /quote.?(sent|request|generat)|cotizaci[oó]n/],
  // Contact attempt
  ["intento de contacto", /contact.?attempt|intento.?contact/],
  // Multi-channel engagement (catches all variants with parenthetical details)
  ["engagement multicanal", /multi.?channel|multicanal|m[uú]ltiples?.?canal/],
  // Multiple conversations / interactions
  ["múltiples conversaciones", /multiple.?convers|m[uú]ltiples?.?convers/],
  // Multiple touchpoints
  ["múltiples puntos de contacto", /multiple.?touch|m[uú]ltiples?.?punto|touchpoint/],
  // High purchase intent
  ["alta intención de compra", /high.?purchase|alta.?intenci[oó]n|purchase.?intent/],
  // Requesting quote
  ["solicitando cotización", /request.?quote|solicit.?cotiz/],
  // Ready to close
  ["listo para cerrar", /ready.?to.?close|listo.?para.?cerrar|close.?deal/],
  // Active comparison / shopping
  ["comparando activamente", /active.?compar|compar.?activ|shopping/],
  // Repeat / returning customer
  ["cliente recurrente", /repeat.?customer|return.?customer|cliente.?recur/],
  // Referral
  ["potencial de referido", /referral|referido/],
  // Upsell
  ["oportunidad de upsell", /upsell/],
  // Cross-sell
  ["oportunidad de cross-sell", /cross.?sell/],
  // Decision maker
  ["tomador de decisiones", /decision.?maker|tomador/],
  // Timeline urgency
  ["urgencia de tiempo", /timeline.?urgen|urgencia.?tiempo|urgent/],
  // Project defined
  ["proyecto definido", /project.?defin|proyecto.?defin/],
  // Brand loyal
  ["leal a la marca", /brand.?loyal|leal.?marca/],
  // Engaged recently
  ["interacción reciente", /engaged.?recent|interacci[oó]n.?reciente|recent.?engag/],
  // Follow up needed
  ["necesita seguimiento", /needs?.?follow|necesita.?seguim|follow.?up.?need/],
  // Warm lead
  ["lead tibio", /warm.?lead|lead.?tibio/],
  // Hot lead
  ["lead caliente", /hot.?lead|lead.?caliente/],
  // Price sensitive
  ["sensible al precio", /price.?sensitiv|sensible.?precio/],
  // Consistent engagement
  ["engagement consistente", /consistent.?engag|engag.?consisten/],
  // Positive response / sentiment
  ["respuesta positiva", /positive.?respon|respuesta.?positiv|positive.?sentim/],
  // Interest expressed
  ["interés expresado", /interest.?express|inter[eé]s.?expres|express.?interest|showed?.?interest/],
  // Appointment / meeting
  ["cita agendada", /appointment|meeting.?schedul|cita|reuni[oó]n/],
  // WhatsApp engagement
  ["engagement whatsapp", /whatsapp.?engag|engag.?whatsapp/],
  // Phone engagement
  ["engagement telefónico", /phone.?engag|engag.?phone|tel[eé]fon/],
  // Email engagement
  ["engagement email", /email.?engag|engag.?email|correo/],
  // Product interest
  ["interés en producto", /product.?interest|inter[eé]s.?product/],
  // Kitchen / cocina specific
  ["interés en cocinas", /kitchen|cocina/],
];

// ─── Risk Flag canonical groups ───
const RISK_CANONICAL: [string, RegExp][] = [
  // No response
  ["sin respuesta", /no.?respon|sin.?respuesta|unresponsiv/],
  // Long inactive
  ["inactivo prolongado", /long.?inactiv|inactivo.?prolong|prolonged?.?inactiv/],
  // Price objection
  ["objeción de precio", /price.?objection|objeci[oó]n.?precio/],
  // Competitor risk
  ["riesgo de competencia", /competitor|competencia|competing/],
  // Budget mismatch / no budget
  ["presupuesto no coincide", /budget.?(mismatch|issue|problem|no)|no.?budget|sin.?presupuesto|presupuesto.?no/],
  // Declining engagement
  ["engagement decreciente", /declin.?engag|engag.?declin|decrec/],
  // Negative sentiment
  ["sentimiento negativo", /negative.?sentim|sentimiento.?negativ/],
  // Delayed decision
  ["decisión retrasada", /delay.?decision|decisi[oó]n.?retras|slow.?decision/],
  // Lost interest
  ["perdió interés", /lost?.?interest|perdi[oó].?inter[eé]s|losing.?interest/],
  // Poor fit
  ["mal ajuste", /poor.?fit|mal.?ajuste|bad.?fit/],
  // Communication gap
  ["brecha de comunicación", /communic.?gap|brecha.?comunic|gap.?communic/],
  // Stale lead
  ["lead estancado", /stale.?lead|lead.?estanc|stuck.?lead/],
  // High churn risk
  ["alto riesgo de abandono", /high.?churn|churn.?risk|riesgo.?abandon/],
  // Duplicate lead
  ["lead duplicado", /duplicate.?lead|lead.?duplic/],
  // Wrong contact
  ["contacto incorrecto", /wrong.?contact|contacto.?incorrecto|bad.?contact/],
  // Timeline mismatch
  ["timeline no coincide", /timeline.?mismatch|timeline.?no/],
  // Ghosting
  ["sin contacto (ghosting)", /ghost/],
  // Complaint
  ["queja registrada", /complaint|queja/],
  // Slow response time
  ["tiempo de respuesta lento", /slow.?respon|response.?time|tiempo.?respuesta/],
  // No follow-up
  ["falta de seguimiento", /no.?follow|lack.?follow|falta.?seguim|without.?follow/],
  // Low engagement
  ["bajo engagement", /low.?engag|bajo.?engag/],
  // Missed opportunity
  ["oportunidad perdida", /missed?.?opportun|oportunidad.?perdid/],
  // Information gap
  ["falta de información", /information.?gap|info.?missing|falta.?inform/],
  // Long sales cycle
  ["ciclo de venta largo", /long.?sales?.?cycle|ciclo.?venta.?largo/],
  // Inconsistent contact
  ["contacto inconsistente", /inconsistent.?contact|contacto.?inconsist/],
];

/**
 * Normalize a raw signal string to its canonical form.
 * @param raw  The raw signal from the AI agent
 * @param type "intent" or "risk"
 * @returns Canonical label (Spanish)
 */
export function normalizeSignal(raw: string, type: "intent" | "risk"): string {
  // Step 1: clean
  const cleaned = raw
    .toLowerCase()
    .replace(/[_\-]/g, " ")
    .replace(/\(.*?\)/g, " ")   // strip parenthetical details like (phone, whatsapp)
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return raw;

  // Step 2: match against canonical patterns
  const canonicals = type === "intent" ? INTENT_CANONICAL : RISK_CANONICAL;
  for (const [label, pattern] of canonicals) {
    if (pattern.test(cleaned)) return label;
  }

  // Step 3: no match — return cleaned version
  return cleaned;
}
