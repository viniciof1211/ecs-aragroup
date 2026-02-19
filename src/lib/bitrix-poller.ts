/**
 * Bitrix24 REST API Poller
 * Fetches leads from the Bitrix24 webhook every POLL_INTERVAL seconds,
 * normalizes them into ECSLead format, and triggers ECS score recalculation.
 */
import type { ECSLead, ECSInteraction } from "@/types/ecs";
import { calculateECSScore } from "@/lib/ecs-engine";
import { getSegmentFromScore } from "@/types/ecs";

// Use local proxy to avoid CORS issues (both dev and prod serve /api/bitrix/)
const BITRIX_WEBHOOK =
  (import.meta.env.VITE_BITRIX_WEBHOOK_URL ?? "/api/bitrix").replace(/\/+$/, "");

const POLL_INTERVAL =
  (Number(import.meta.env.VITE_POLL_INTERVAL_SECONDS) || 180) * 1000;

// ─── Stage → Status mapping ───
function mapBitrixStatus(statusId: string | undefined): string {
  if (!statusId) return "new";
  if (statusId === "NEW") return "new";
  if (statusId === "IN_PROCESS") return "contacted";
  if (statusId === "PROCESSED") return "qualified";
  if (statusId === "CONVERTED") return "won";
  if (statusId === "JUNK") return "lost";
  return "contacted";
}

// ─── Origin → Channel mapping ───
function mapSourceChannel(sourceId: string | undefined): string {
  if (!sourceId) return "unknown";
  const s = sourceId.toUpperCase();
  if (s.includes("WEB") || s.includes("FORM")) return "web";
  if (s.includes("PHONE") || s.includes("CALL")) return "phone";
  if (s.includes("EMAIL")) return "email";
  if (s.includes("FB") || s.includes("FACEBOOK")) return "facebook";
  if (s.includes("WA") || s.includes("WHATSAPP")) return "whatsapp";
  if (s.includes("CHAT") || s.includes("LIVE")) return "chat";
  return "other";
}

// ─── Normalize a Bitrix lead to ECSLead ───
function normalizeBitrixLead(raw: Record<string, unknown>): ECSLead {
  const id = String(raw.ID ?? "");
  const leadId = `lead_bx_${id}`;
  const nombre = String(raw.NAME ?? "").trim();
  const apellido = String(raw.LAST_NAME ?? "").trim();
  const name = `${nombre} ${apellido}`.trim() || `Lead #${id}`;

  const created = raw.DATE_CREATE ? String(raw.DATE_CREATE) : new Date().toISOString();
  const modified = raw.DATE_MODIFY ? String(raw.DATE_MODIFY) : created;

  return {
    id: leadId,
    lead_id: leadId,
    bitrix_id: Number(id) || null,
    name,
    email: raw.EMAIL
      ? Array.isArray(raw.EMAIL) && raw.EMAIL.length > 0
        ? String((raw.EMAIL[0] as Record<string, unknown>)?.VALUE ?? "")
        : null
      : null,
    phone: raw.PHONE
      ? Array.isArray(raw.PHONE) && raw.PHONE.length > 0
        ? String((raw.PHONE[0] as Record<string, unknown>)?.VALUE ?? "")
        : null
      : null,
    company: raw.COMPANY_TITLE ? String(raw.COMPANY_TITLE) : null,
    brand: raw.UF_CRM_DIVISION ? String(raw.UF_CRM_DIVISION) : null,
    source: raw.SOURCE_ID ? String(raw.SOURCE_ID) : null,
    status: mapBitrixStatus(raw.STATUS_ID ? String(raw.STATUS_ID) : undefined) as ECSLead["status"],
    channels: [mapSourceChannel(raw.SOURCE_ID ? String(raw.SOURCE_ID) : undefined)],
    employees: raw.ASSIGNED_BY_ID ? [String(raw.ASSIGNED_BY_ID)] : [],
    interaction_count: 0,
    total_messages: 0,
    first_seen: created,
    last_seen: modified,
    bitrix_lead_ids: [Number(id) || 0],
    current_score: 0,
    previous_score: 0,
    segment: "new" as ECSLead["segment"],
    created_at: created,
    last_interaction_at: modified,
    bitrix_raw: null,
    updated_at: new Date().toISOString(),
    etapa_bitrix: raw.STATUS_SEMANTIC_ID ? String(raw.STATUS_SEMANTIC_ID) : null,
    loss_reason: null,
    loss_reason_raw: null,
    budget_range: null,
    project_timeline: null,
    client_type: null,
    project_type: null,
    design_type: null,
    designing: null,
    product_sold: null,
    profile: null,
    cargo: raw.POST ? String(raw.POST) : null,
    total_amount: raw.OPPORTUNITY ? Number(raw.OPPORTUNITY) : 0,
    currency: raw.CURRENCY_ID ? String(raw.CURRENCY_ID) : null,
    sucursal: null,
    division: raw.UF_CRM_DIVISION ? String(raw.UF_CRM_DIVISION) : null,
    utm_source: raw.UTM_SOURCE ? String(raw.UTM_SOURCE) : null,
    score_breakdown: null,
  };
}

const LEAD_SELECT_FIELDS = [
  "ID", "NAME", "LAST_NAME", "SECOND_NAME", "TITLE",
  "STATUS_ID", "STATUS_SEMANTIC_ID", "SOURCE_ID", "SOURCE_DESCRIPTION",
  "COMPANY_TITLE", "POST", "OPPORTUNITY", "CURRENCY_ID",
  "DATE_CREATE", "DATE_MODIFY", "DATE_CLOSED",
  "ASSIGNED_BY_ID", "CREATED_BY_ID",
  "PHONE", "EMAIL", "WEB",
  "UTM_SOURCE", "UTM_MEDIUM", "UTM_CAMPAIGN",
  "COMMENTS",
];

/** Encode nested params the way Bitrix24 REST expects them */
function toBitrixParams(obj: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams();
  function encode(prefix: string, value: unknown) {
    if (Array.isArray(value)) {
      value.forEach((v, i) => encode(`${prefix}[${i}]`, v));
    } else if (value !== null && typeof value === "object") {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        encode(`${prefix}[${k}]`, v);
      }
    } else {
      params.append(prefix, String(value));
    }
  }
  for (const [k, v] of Object.entries(obj)) {
    encode(k, v);
  }
  return params;
}

// ─── Fetch leads from Bitrix24 REST API ───
export async function fetchBitrixLeads(
  start = 0
): Promise<{ leads: Record<string, unknown>[]; total: number; next: number | null }> {
  const url = `${BITRIX_WEBHOOK}/crm.lead.list.json`;
  const body = toBitrixParams({
    start,
    order: { DATE_MODIFY: "DESC" },
    select: LEAD_SELECT_FIELDS,
  });

  const res = await fetch(url, { method: "POST", body });
  if (!res.ok) throw new Error(`Bitrix API error: ${res.status}`);

  const data = await res.json();
  return {
    leads: (data.result ?? []) as Record<string, unknown>[],
    total: data.total ?? 0,
    next: data.next ?? null,
  };
}

// ─── Fetch recently modified leads (last N minutes) ───
export async function fetchRecentLeads(
  minutesAgo = 5
): Promise<ECSLead[]> {
  const since = new Date(Date.now() - minutesAgo * 60 * 1000);
  const sinceStr = since.toISOString().replace("T", " ").slice(0, 19);

  const url = `${BITRIX_WEBHOOK}/crm.lead.list.json`;
  const body = toBitrixParams({
    order: { DATE_MODIFY: "DESC" },
    filter: { ">DATE_MODIFY": sinceStr },
    select: LEAD_SELECT_FIELDS,
  });

  const res = await fetch(url, { method: "POST", body });
  if (!res.ok) throw new Error(`Bitrix API error: ${res.status}`);

  const data = await res.json();
  const rawLeads = (data.result ?? []) as Record<string, unknown>[];
  return rawLeads.map(normalizeBitrixLead);
}

// ─── Merge polled leads into existing leads array ───
export function mergePolledLeads(
  existing: ECSLead[],
  polled: ECSLead[],
  existingInteractions: ECSInteraction[]
): ECSLead[] {
  const leadMap = new Map<string, ECSLead>();

  // Index existing leads by bitrix_id for dedup
  const bitrixIdMap = new Map<number, string>();
  for (const l of existing) {
    leadMap.set(l.id, l);
    if (l.bitrix_id) bitrixIdMap.set(l.bitrix_id, l.id);
    for (const bid of l.bitrix_lead_ids ?? []) {
      bitrixIdMap.set(bid, l.id);
    }
  }

  for (const polledLead of polled) {
    const bxId = polledLead.bitrix_id;
    const existingId = bxId ? bitrixIdMap.get(bxId) : null;

    if (existingId) {
      // Update existing lead with fresh Bitrix data
      const existing = leadMap.get(existingId)!;
      const updated: ECSLead = {
        ...existing,
        status: polledLead.status,
        last_seen: polledLead.last_seen,
        last_interaction_at: polledLead.last_interaction_at,
        updated_at: new Date().toISOString(),
        etapa_bitrix: polledLead.etapa_bitrix ?? existing.etapa_bitrix,
        total_amount: polledLead.total_amount || existing.total_amount,
      };

      // Recalculate ECS score with existing interactions
      const leadInts = existingInteractions.filter((i) => i.lead_id === existingId);
      if (leadInts.length > 0) {
        const breakdown = calculateECSScore(leadInts);
        updated.previous_score = updated.current_score;
        updated.current_score = breakdown.total;
        updated.segment = getSegmentFromScore(breakdown.total);
        updated.score_breakdown = breakdown;
      }

      leadMap.set(existingId, updated);
    } else {
      // New lead from Bitrix
      leadMap.set(polledLead.id, polledLead);
      if (bxId) bitrixIdMap.set(bxId, polledLead.id);
    }
  }

  return Array.from(leadMap.values());
}

// ─── Polling state ───
let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastPollAt: Date | null = null;

export function getLastPollTime(): Date | null {
  return lastPollAt;
}

export function getPollInterval(): number {
  return POLL_INTERVAL;
}

export type PollCallback = (leads: ECSLead[]) => void;

export function startPolling(callback: PollCallback): void {
  if (pollTimer) return; // already running

  const doPoll = async () => {
    try {
      const minutesSinceLastPoll = lastPollAt
        ? Math.ceil((Date.now() - lastPollAt.getTime()) / 60000) + 1
        : 5;
      const recentLeads = await fetchRecentLeads(minutesSinceLastPoll);
      lastPollAt = new Date();

      if (recentLeads.length > 0) {
        console.log(`[Bitrix Poll] ${recentLeads.length} leads updated`);
        callback(recentLeads);
      } else {
        console.log("[Bitrix Poll] No changes detected");
      }
    } catch (err) {
      console.error("[Bitrix Poll] Error:", err);
    }
  };

  // Initial poll
  doPoll();

  // Schedule recurring polls
  pollTimer = setInterval(doPoll, POLL_INTERVAL);
  console.log(`[Bitrix Poll] Started — interval: ${POLL_INTERVAL / 1000}s`);
}

export function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    console.log("[Bitrix Poll] Stopped");
  }
}
