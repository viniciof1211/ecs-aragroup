/**
 * Spanish translation layer for Sentiment AI outputs.
 * The Modal agent returns results in English — this module
 * translates intent_signals, risk_flags, recommended_action,
 * and reasoning to Spanish before display.
 */

const INTENT_SIGNAL_MAP: Record<string, string> = {
  "high_purchase_intent": "Alta intención de compra",
  "budget_ready": "Presupuesto listo",
  "active_comparison": "Comparando activamente",
  "repeat_customer": "Cliente recurrente",
  "referral_potential": "Potencial de referido",
  "upsell_opportunity": "Oportunidad de upsell",
  "cross_sell_opportunity": "Oportunidad de cross-sell",
  "decision_maker": "Tomador de decisiones",
  "timeline_urgency": "Urgencia de tiempo",
  "project_defined": "Proyecto definido",
  "design_interest": "Interés en diseño",
  "showroom_visit": "Visita a showroom",
  "price_sensitive": "Sensible al precio",
  "brand_loyal": "Leal a la marca",
  "multiple_touchpoints": "Múltiples puntos de contacto",
  "engaged_recently": "Interacción reciente",
  "requesting_quote": "Solicitando cotización",
  "ready_to_close": "Listo para cerrar",
  "needs_follow_up": "Necesita seguimiento",
  "warm_lead": "Lead tibio",
  "hot_lead": "Lead caliente",
};

const RISK_FLAG_MAP: Record<string, string> = {
  "no_response": "Sin respuesta",
  "long_inactive": "Inactivo prolongado",
  "price_objection": "Objeción de precio",
  "competitor_risk": "Riesgo de competencia",
  "budget_mismatch": "Presupuesto no coincide",
  "declining_engagement": "Engagement decreciente",
  "negative_sentiment": "Sentimiento negativo",
  "unresponsive": "No responde",
  "delayed_decision": "Decisión retrasada",
  "lost_interest": "Perdió interés",
  "poor_fit": "Mal ajuste",
  "communication_gap": "Brecha de comunicación",
  "stale_lead": "Lead estancado",
  "high_churn_risk": "Alto riesgo de abandono",
  "duplicate_lead": "Lead duplicado",
  "wrong_contact": "Contacto incorrecto",
  "timeline_mismatch": "Timeline no coincide",
  "no_budget": "Sin presupuesto",
  "ghosting": "Sin contacto (ghosting)",
  "complaint": "Queja registrada",
};

// ── Multi-word phrase regexes (applied FIRST, order matters) ──
const PHRASE_REGEXES: [RegExp, string][] = [
  [/\bhas not been\b/gi, "no ha sido"],
  [/\bhave not been\b/gi, "no han sido"],
  [/\bhas not\b/gi, "no ha"],
  [/\bhave not\b/gi, "no han"],
  [/\bdoes not have\b/gi, "no tiene"],
  [/\bdoes not\b/gi, "no"],
  [/\bdo not\b/gi, "no"],
  [/\bdid not\b/gi, "no"],
  [/\bis not\b/gi, "no es"],
  [/\bare not\b/gi, "no son"],
  [/\bwas not\b/gi, "no fue"],
  [/\bwill not\b/gi, "no va a"],
  [/\bshould not\b/gi, "no debería"],
  [/\bcould not\b/gi, "no pudo"],
  [/\bwould not\b/gi, "no"],
  [/\bclose the deal\b/gi, "cerrar el negocio"],
  [/\bfollow up with\b/gi, "dar seguimiento con"],
  [/\bfollow[- ]up\b/gi, "seguimiento"],
  [/\bfollow up\b/gi, "dar seguimiento"],
  [/\bschedule a call\b/gi, "programar una llamada"],
  [/\bsend an email\b/gi, "enviar un correo"],
  [/\bsend a message\b/gi, "enviar un mensaje"],
  [/\bno response\b/gi, "sin respuesta"],
  [/\bno activity\b/gi, "sin actividad"],
  [/\bhigh engagement\b/gi, "alto engagement"],
  [/\blow engagement\b/gi, "bajo engagement"],
  [/\bthe lead\b/gi, "el lead"],
  [/\bthis lead\b/gi, "este lead"],
  [/\bhas shown\b/gi, "ha mostrado"],
  [/\bhas been\b/gi, "ha sido"],
  [/\bhave been\b/gi, "han sido"],
  [/\bshould be\b/gi, "debería ser"],
  [/\bneeds to be\b/gi, "necesita ser"],
  [/\bneeds to\b/gi, "necesita"],
  [/\bwe recommend\b/gi, "recomendamos"],
  [/\bI recommend\b/gi, "recomiendo"],
  [/\binitial interest\b/gi, "interés inicial"],
  [/\bstrong interest\b/gi, "fuerte interés"],
  [/\bweak interest\b/gi, "interés débil"],
  [/\bbased on\b/gi, "basado en"],
  [/\bdue to\b/gi, "debido a"],
  [/\bin order to\b/gi, "para"],
  [/\bloss reasons?\b/gi, "razones de pérdida"],
  [/\bre-?engage\b/gi, "re-contactar"],
  [/\bre-?contact\b/gi, "re-contactar"],
  [/\bmixed signals?\b/gi, "señales mixtas"],
  [/\blow conversion potential\b/gi, "bajo potencial de conversión"],
  [/\bhigh conversion potential\b/gi, "alto potencial de conversión"],
  [/\bconversion potential\b/gi, "potencial de conversión"],
  [/\bminimal messaging\b/gi, "mensajería mínima"],
  [/\bshowroom visit\b/gi, "visita a showroom"],
  [/\bvia WhatsApp\b/gi, "por WhatsApp"],
  [/\bvia email\b/gi, "por correo"],
  [/\bvia phone\b/gi, "por teléfono"],
  [/\bnot interested\b/gi, "no interesado"],
  [/\bas well as\b/gi, "así como"],
  [/\bin addition\b/gi, "además"],
  [/\bon the other hand\b/gi, "por otro lado"],
  [/\bat least\b/gi, "al menos"],
  [/\bat most\b/gi, "como máximo"],
  [/\bso far\b/gi, "hasta ahora"],
  [/\bso that\b/gi, "para que"],
  [/\beven though\b/gi, "aunque"],
  [/\bas a result\b/gi, "como resultado"],
  [/\bin fact\b/gi, "de hecho"],
  [/\bfor example\b/gi, "por ejemplo"],
  [/\bin general\b/gi, "en general"],
  [/\bin particular\b/gi, "en particular"],
  [/\bin this case\b/gi, "en este caso"],
  [/\bright now\b/gi, "ahora mismo"],
  [/\bup to\b/gi, "hasta"],
  [/\bmore than\b/gi, "más que"],
  [/\bless than\b/gi, "menos que"],
  [/\brather than\b/gi, "en lugar de"],
  [/\bsuch as\b/gi, "como"],
  [/\bwhich is\b/gi, "lo cual es"],
  [/\bthat is\b/gi, "es decir"],
  [/\bthere is\b/gi, "hay"],
  [/\bthere are\b/gi, "hay"],
  [/\bthere was\b/gi, "hubo"],
  [/\bit is\b/gi, "es"],
  [/\bit was\b/gi, "fue"],
  [/\bthey are\b/gi, "son"],
  [/\bthey have\b/gi, "tienen"],
  [/\bwe have\b/gi, "tenemos"],
  [/\bto be\b/gi, "ser"],
];

// ── Single-word dictionary (case-insensitive lookup) ──
// Uses a Map for O(1) lookup per word instead of iterating hundreds of regexes.
const WORD_MAP = new Map<string, string>([
  // Connectors / glue words (the biggest gap in the old approach)
  ["and", "y"], ["but", "pero"], ["or", "o"], ["nor", "ni"],
  ["with", "con"], ["without", "sin"], ["from", "de"], ["into", "en"],
  ["about", "sobre"], ["after", "después de"], ["before", "antes de"],
  ["during", "durante"], ["through", "a través de"], ["over", "sobre"],
  ["under", "bajo"], ["between", "entre"], ["among", "entre"],
  ["across", "a través de"], ["along", "a lo largo de"],
  ["since", "desde"], ["until", "hasta"], ["while", "mientras"],
  ["because", "porque"], ["although", "aunque"], ["if", "si"],
  ["when", "cuando"], ["where", "donde"], ["then", "entonces"],
  ["than", "que"], ["so", "así que"], ["yet", "aún"], ["still", "aún"],
  ["already", "ya"], ["just", "solo"], ["only", "solo"], ["even", "incluso"],
  ["also", "también"], ["too", "también"], ["very", "muy"],
  ["quite", "bastante"], ["really", "realmente"], ["truly", "verdaderamente"],
  ["likely", "probablemente"], ["unlikely", "improbable"],
  ["perhaps", "quizás"], ["maybe", "quizás"], ["probably", "probablemente"],
  ["clearly", "claramente"], ["obviously", "obviamente"],
  ["especially", "especialmente"], ["particularly", "particularmente"],
  ["significantly", "significativamente"], ["slightly", "ligeramente"],
  ["extremely", "extremadamente"], ["highly", "altamente"],
  ["primarily", "principalmente"], ["mainly", "principalmente"],
  ["mostly", "mayormente"], ["partially", "parcialmente"],
  ["fully", "completamente"], ["entirely", "enteramente"],
  ["completely", "completamente"], ["currently", "actualmente"],
  ["recently", "recientemente"], ["previously", "previamente"],
  ["initially", "inicialmente"], ["finally", "finalmente"],
  ["eventually", "eventualmente"], ["immediately", "inmediatamente"],
  ["frequently", "frecuentemente"], ["rarely", "raramente"],
  ["never", "nunca"], ["always", "siempre"], ["often", "a menudo"],
  ["sometimes", "a veces"], ["usually", "usualmente"],
  ["typically", "típicamente"], ["generally", "generalmente"],
  // Articles / pronouns / determiners
  ["the", "el"], ["a", "un"], ["an", "un"],
  ["this", "este"], ["that", "ese"], ["these", "estos"], ["those", "esos"],
  ["some", "algunos"], ["any", "cualquier"], ["all", "todos"],
  ["every", "cada"], ["each", "cada"], ["both", "ambos"],
  ["either", "cualquiera"], ["neither", "ninguno"],
  ["other", "otro"], ["another", "otro"], ["same", "mismo"],
  ["different", "diferente"], ["many", "muchos"], ["few", "pocos"],
  ["much", "mucho"], ["more", "más"], ["less", "menos"],
  ["most", "la mayoría"], ["least", "lo mínimo"], ["several", "varios"],
  ["none", "ninguno"], ["no", "sin"], ["not", "no"],
  ["its", "su"], ["their", "su"], ["our", "nuestro"], ["your", "su"],
  ["his", "su"], ["her", "su"], ["my", "mi"],
  // Common verbs
  ["is", "es"], ["are", "son"], ["was", "fue"], ["were", "fueron"],
  ["has", "tiene"], ["have", "tienen"], ["had", "tenía"],
  ["will", "va a"], ["would", "podría"], ["could", "podría"],
  ["should", "debería"], ["may", "puede"], ["might", "podría"],
  ["can", "puede"], ["need", "necesitar"], ["needs", "necesita"],
  ["want", "querer"], ["wants", "quiere"],
  ["show", "muestra"], ["shows", "muestra"], ["showing", "mostrando"], ["shown", "mostrado"],
  ["indicate", "indica"], ["indicates", "indica"], ["indicating", "indicando"],
  ["suggest", "sugiere"], ["suggests", "sugiere"], ["suggesting", "sugiriendo"],
  ["demonstrate", "demuestra"], ["demonstrates", "demuestra"],
  ["reflect", "refleja"], ["reflects", "refleja"],
  ["represent", "representa"], ["represents", "representa"],
  ["require", "requiere"], ["requires", "requiere"], ["requiring", "requiriendo"],
  ["include", "incluye"], ["includes", "incluye"], ["including", "incluyendo"],
  ["provide", "provee"], ["provides", "provee"], ["providing", "proporcionando"],
  ["ensure", "asegura"], ["ensures", "asegura"],
  ["allow", "permite"], ["allows", "permite"], ["allowing", "permitiendo"],
  ["consider", "considerar"], ["considers", "considera"], ["considering", "considerando"],
  ["remain", "permanece"], ["remains", "permanece"], ["remaining", "restante"],
  ["appear", "parece"], ["appears", "parece"],
  ["seem", "parece"], ["seems", "parece"],
  ["lack", "carece de"], ["lacks", "carece de"], ["lacking", "careciendo de"],
  ["focus", "enfoque"], ["focused", "enfocado"], ["focusing", "enfocándose"],
  ["try", "intentar"], ["trying", "intentando"], ["tried", "intentó"],
  ["keep", "mantener"], ["keeping", "manteniendo"],
  ["make", "hacer"], ["making", "haciendo"], ["made", "hecho"],
  ["take", "tomar"], ["taking", "tomando"], ["took", "tomó"],
  ["give", "dar"], ["gives", "da"], ["given", "dado"],
  ["use", "usar"], ["using", "usando"], ["used", "usado"],
  ["been", "sido"], ["being", "siendo"],
  ["become", "convertirse"], ["becomes", "se convierte"],
  ["know", "saber"], ["known", "conocido"],
  ["see", "ver"], ["seen", "visto"],
  ["get", "obtener"], ["getting", "obteniendo"], ["got", "obtuvo"],
  ["go", "ir"], ["going", "yendo"], ["gone", "ido"],
  ["come", "venir"], ["comes", "viene"], ["coming", "viniendo"],
  // Business / sentiment domain
  ["recommend", "recomendar"], ["recommended", "recomendado"],
  ["investigate", "investigar"], ["qualification", "calificación"],
  ["urgent", "urgente"], ["priority", "prioridad"],
  ["customer", "cliente"], ["customers", "clientes"],
  ["prospect", "prospecto"], ["prospects", "prospectos"],
  ["conversion", "conversión"], ["retention", "retención"], ["churn", "abandono"],
  ["positive", "positivo"], ["negative", "negativo"], ["neutral", "neutral"],
  ["engagement", "engagement"],
  ["interaction", "interacción"], ["interactions", "interacciones"],
  ["purchase", "compra"], ["budget", "presupuesto"],
  ["design", "diseño"], ["kitchen", "cocina"], ["closet", "closet"],
  ["bathroom", "baño"], ["project", "proyecto"], ["showroom", "showroom"],
  ["quote", "cotización"], ["deal", "negocio"], ["deals", "negocios"],
  ["active", "activo"], ["inactive", "inactivo"],
  ["recent", "reciente"], ["overall", "en general"],
  ["however", "sin embargo"], ["therefore", "por lo tanto"],
  ["which", "el cual"], ["potential", "potencial"],
  ["depth", "profundidad"], ["messaging", "mensajería"],
  ["lost", "perdido"], ["won", "ganado"],
  ["open", "abierto"], ["closed", "cerrado"],
  ["reason", "razón"], ["reasons", "razones"],
  ["signal", "señal"], ["signals", "señales"],
  ["visit", "visita"], ["visits", "visitas"],
  ["minimal", "mínimo"], ["contact", "contacto"],
  ["response", "respuesta"], ["responses", "respuestas"],
  ["scoring", "puntuación"], ["score", "puntaje"],
  ["history", "historial"], ["analysis", "análisis"],
  ["opportunity", "oportunidad"], ["opportunities", "oportunidades"],
  ["improve", "mejorar"], ["increase", "aumentar"], ["decrease", "disminuir"],
  ["maintain", "mantener"], ["monitor", "monitorear"], ["track", "rastrear"],
  ["personalized", "personalizado"], ["personalize", "personalizar"],
  ["offer", "oferta"], ["discount", "descuento"],
  ["promotion", "promoción"], ["campaign", "campaña"],
  ["strategy", "estrategia"], ["approach", "enfoque"],
  ["target", "objetivo"], ["achieve", "lograr"],
  ["success", "éxito"], ["successful", "exitoso"],
  ["failure", "fracaso"], ["failed", "fallido"],
  ["risk", "riesgo"], ["risks", "riesgos"],
  ["high", "alto"], ["low", "bajo"], ["medium", "medio"],
  ["strong", "fuerte"], ["weak", "débil"],
  ["current", "actual"], ["previous", "anterior"], ["next", "siguiente"],
  ["step", "paso"], ["action", "acción"],
  ["result", "resultado"], ["results", "resultados"],
  ["data", "datos"], ["information", "información"],
  ["details", "detalles"], ["summary", "resumen"],
  ["report", "reporte"], ["status", "estado"], ["progress", "progreso"],
  ["complete", "completo"], ["incomplete", "incompleto"],
  ["pending", "pendiente"], ["overdue", "vencido"],
  ["scheduled", "programado"], ["confirmed", "confirmado"],
  ["cancelled", "cancelado"], ["rejected", "rechazado"],
  ["accepted", "aceptado"], ["approved", "aprobado"],
  ["waiting", "esperando"], ["processing", "procesando"],
  ["delivered", "entregado"], ["sent", "enviado"], ["received", "recibido"],
  ["opened", "abierto"], ["interested", "interesado"],
  ["qualified", "calificado"], ["unqualified", "no calificado"],
  ["contacted", "contactado"], ["followed", "seguido"],
  ["updated", "actualizado"], ["created", "creado"],
  ["deleted", "eliminado"], ["modified", "modificado"],
  ["changed", "cambiado"], ["added", "agregado"], ["removed", "eliminado"],
  ["new", "nuevo"], ["old", "antiguo"], ["existing", "existente"],
  ["available", "disponible"], ["unavailable", "no disponible"],
  ["required", "requerido"], ["optional", "opcional"],
  ["important", "importante"], ["critical", "crítico"],
  ["special", "especial"], ["custom", "personalizado"],
  ["enabled", "habilitado"], ["disabled", "deshabilitado"],
  ["error", "error"], ["warning", "advertencia"],
  ["message", "mensaje"], ["messages", "mensajes"],
  ["call", "llamada"], ["calls", "llamadas"],
  ["meeting", "reunión"], ["meetings", "reuniones"],
  ["task", "tarea"], ["tasks", "tareas"],
  ["note", "nota"], ["notes", "notas"],
  ["comment", "comentario"], ["comments", "comentarios"],
  ["feedback", "retroalimentación"], ["review", "revisión"],
  ["website", "sitio web"], ["page", "página"],
  ["document", "documento"], ["category", "categoría"],
  ["label", "etiqueta"], ["name", "nombre"], ["title", "título"],
  ["description", "descripción"], ["type", "tipo"],
  ["value", "valor"], ["amount", "monto"],
  ["price", "precio"], ["cost", "costo"], ["total", "total"],
  ["average", "promedio"], ["maximum", "máximo"], ["minimum", "mínimo"],
  ["count", "cantidad"], ["percentage", "porcentaje"],
  ["ratio", "proporción"], ["rate", "tasa"],
  ["trend", "tendencia"], ["growth", "crecimiento"], ["decline", "declive"],
  ["stable", "estable"], ["consistent", "consistente"],
  ["reliable", "confiable"], ["unreliable", "no confiable"],
  // Extra words from user's real examples
  ["shallow", "superficial"], ["unsuccessful", "fallido"],
  ["major", "mayor"], ["minor", "menor"],
  ["initial", "inicial"], ["interest", "interés"],
  ["duration", "duración"], ["convo", "conversación"], ["convos", "conversaciones"],
  ["conversations", "conversaciones"], ["conversation", "conversación"],
  ["attempt", "intento"], ["attempts", "intentos"],
  ["reached", "contactado"], ["reaching", "contactando"],
  ["lack", "falta"], ["lacks", "carece de"],
  ["deeper", "más profundo"], ["further", "más"],
  ["early", "temprano"], ["late", "tarde"],
  ["first", "primero"], ["last", "último"],
  ["second", "segundo"], ["third", "tercero"],
  ["once", "una vez"], ["twice", "dos veces"],
  ["again", "de nuevo"], ["back", "de vuelta"],
  ["here", "aquí"], ["there", "ahí"],
  ["now", "ahora"], ["today", "hoy"],
  ["yesterday", "ayer"], ["tomorrow", "mañana"],
  ["soon", "pronto"], ["later", "después"],
  ["long", "largo"], ["short", "corto"],
  ["good", "bueno"], ["bad", "malo"],
  ["best", "mejor"], ["worst", "peor"],
  ["better", "mejor"], ["worse", "peor"],
  ["large", "grande"], ["small", "pequeño"],
  ["big", "grande"], ["little", "poco"],
  ["fast", "rápido"], ["slow", "lento"],
  ["quick", "rápido"], ["quickly", "rápidamente"],
  ["slowly", "lentamente"],
  ["enough", "suficiente"], ["almost", "casi"],
  ["nearly", "casi"], ["approximately", "aproximadamente"],
  ["exactly", "exactamente"], ["roughly", "aproximadamente"],
  ["around", "alrededor de"], ["within", "dentro de"],
  ["below", "debajo"], ["above", "encima"],
  ["toward", "hacia"], ["towards", "hacia"],
  ["away", "lejos"], ["near", "cerca"],
  ["far", "lejos"], ["close", "cerca"],
  ["together", "juntos"], ["apart", "separados"],
  ["instead", "en su lugar"], ["otherwise", "de lo contrario"],
  ["meanwhile", "mientras tanto"], ["furthermore", "además"],
  ["moreover", "además"], ["nevertheless", "sin embargo"],
  ["nonetheless", "no obstante"], ["regardless", "independientemente"],
  ["accordingly", "en consecuencia"], ["consequently", "consecuentemente"],
  ["hence", "por lo tanto"], ["thus", "así"],
  ["whereby", "por lo cual"], ["whereas", "mientras que"],
]);

/**
 * Translate a known intent signal key to Spanish.
 */
export function translateIntentSignal(signal: string): string {
  return INTENT_SIGNAL_MAP[signal] ?? translateFreeText(signal);
}

/**
 * Translate a known risk flag key to Spanish.
 */
export function translateRiskFlag(flag: string): string {
  return RISK_FLAG_MAP[flag] ?? translateFreeText(flag);
}

/**
 * Best-effort translation of free-form English text to Spanish.
 * Two-pass approach:
 *   1. Multi-word phrase regexes (longest-first)
 *   2. Word-level Map lookup for remaining English words
 * Always runs — the AI agent often returns mixed English/Spanish text.
 */
export function translateFreeText(text: string): string {
  if (!text) return text;

  // Pass 1: multi-word phrases
  let result = text;
  for (const [pattern, replacement] of PHRASE_REGEXES) {
    result = result.replace(pattern, replacement);
  }

  // Pass 2: word-level dictionary lookup
  result = result.replace(/\b[a-zA-Z]+\b/g, (word) => {
    const lower = word.toLowerCase();
    const translated = WORD_MAP.get(lower);
    if (!translated) return word;
    // Preserve original capitalization for first letter
    if (word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()) {
      return translated.charAt(0).toUpperCase() + translated.slice(1);
    }
    return translated;
  });

  // Replace underscores with spaces
  result = result.replace(/_/g, " ");

  return result;
}

/**
 * Translate all translatable fields of a SentimentResult.
 */
export function translateSentimentResult<T extends {
  intent_signals: string[];
  risk_flags: string[];
  recommended_action: string;
  reasoning: string;
}>(result: T): T {
  return {
    ...result,
    intent_signals: result.intent_signals.map(translateIntentSignal),
    risk_flags: result.risk_flags.map(translateRiskFlag),
    recommended_action: translateFreeText(result.recommended_action),
    reasoning: translateFreeText(result.reasoning),
  };
}
