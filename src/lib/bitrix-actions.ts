/**
 * Bitrix24 REST API — Execute actions on leads.
 * Uses the webhook to create activities, send emails, WhatsApp messages,
 * add notes, schedule calls, and update lead status directly from the app.
 */

const BITRIX_WEBHOOK =
  import.meta.env.VITE_BITRIX_WEBHOOK_URL ??
  "https://hogaresfuncionales.bitrix24.es/rest/9946/5itdztxrr5vfefrg";

export type BitrixActionType =
  | "email"
  | "whatsapp"
  | "call"
  | "note"
  | "meeting"
  | "status_change"
  | "assign";

export interface BitrixActionResult {
  success: boolean;
  action: BitrixActionType;
  bitrixId: number;
  message: string;
  responseData?: unknown;
}

// ─── Generic Bitrix REST call ───
async function bitrixCall(
  method: string,
  params: Record<string, unknown>
): Promise<unknown> {
  const url = `${BITRIX_WEBHOOK}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Bitrix ${method}: ${res.status}`);
  return res.json();
}

// ─── Send Email via Bitrix24 ───
export async function sendEmail(
  bitrixId: number,
  subject: string,
  body: string,
  toEmail: string
): Promise<BitrixActionResult> {
  try {
    const data = await bitrixCall("crm.activity.add", {
      fields: {
        OWNER_TYPE_ID: 1, // Lead
        OWNER_ID: bitrixId,
        TYPE_ID: 4, // Email
        SUBJECT: subject,
        DESCRIPTION: body,
        DESCRIPTION_TYPE: 3, // HTML
        DIRECTION: 2, // Outgoing
        COMMUNICATIONS: [{ VALUE: toEmail, ENTITY_ID: bitrixId, ENTITY_TYPE_ID: 1, TYPE: "EMAIL" }],
        RESPONSIBLE_ID: 0, // Current user
        START_TIME: new Date().toISOString(),
        END_TIME: new Date().toISOString(),
      },
    });
    return { success: true, action: "email", bitrixId, message: `Email enviado a ${toEmail}`, responseData: data };
  } catch (err) {
    return { success: false, action: "email", bitrixId, message: `Error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ─── Send WhatsApp message (via Bitrix24 open channel / timeline comment) ───
export async function sendWhatsApp(
  bitrixId: number,
  phone: string,
  message: string
): Promise<BitrixActionResult> {
  try {
    // Add as timeline comment (WhatsApp integration depends on Bitrix config)
    const data = await bitrixCall("crm.timeline.comment.add", {
      fields: {
        ENTITY_ID: bitrixId,
        ENTITY_TYPE: "lead",
        COMMENT: `📱 WhatsApp a ${phone}:\n${message}`,
      },
    });
    // Also open WhatsApp link for manual send
    return {
      success: true,
      action: "whatsapp",
      bitrixId,
      message: `WhatsApp registrado para ${phone}`,
      responseData: data,
    };
  } catch (err) {
    return { success: false, action: "whatsapp", bitrixId, message: `Error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ─── Schedule a call ───
export async function scheduleCall(
  bitrixId: number,
  phone: string,
  subject: string,
  scheduledAt?: string
): Promise<BitrixActionResult> {
  try {
    const startTime = scheduledAt || new Date().toISOString();
    const endTime = new Date(new Date(startTime).getTime() + 30 * 60000).toISOString();
    const data = await bitrixCall("crm.activity.add", {
      fields: {
        OWNER_TYPE_ID: 1,
        OWNER_ID: bitrixId,
        TYPE_ID: 2, // Call
        SUBJECT: subject,
        DIRECTION: 2,
        COMMUNICATIONS: [{ VALUE: phone, ENTITY_ID: bitrixId, ENTITY_TYPE_ID: 1, TYPE: "PHONE" }],
        START_TIME: startTime,
        END_TIME: endTime,
        RESPONSIBLE_ID: 0,
      },
    });
    return { success: true, action: "call", bitrixId, message: `Llamada programada: ${subject}`, responseData: data };
  } catch (err) {
    return { success: false, action: "call", bitrixId, message: `Error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ─── Add a note / comment to lead timeline ───
export async function addNote(
  bitrixId: number,
  comment: string
): Promise<BitrixActionResult> {
  try {
    const data = await bitrixCall("crm.timeline.comment.add", {
      fields: {
        ENTITY_ID: bitrixId,
        ENTITY_TYPE: "lead",
        COMMENT: comment,
      },
    });
    return { success: true, action: "note", bitrixId, message: "Nota agregada al timeline", responseData: data };
  } catch (err) {
    return { success: false, action: "note", bitrixId, message: `Error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ─── Schedule a meeting ───
export async function scheduleMeeting(
  bitrixId: number,
  subject: string,
  description: string,
  startTime: string,
  durationMinutes = 60
): Promise<BitrixActionResult> {
  try {
    const endTime = new Date(new Date(startTime).getTime() + durationMinutes * 60000).toISOString();
    const data = await bitrixCall("crm.activity.add", {
      fields: {
        OWNER_TYPE_ID: 1,
        OWNER_ID: bitrixId,
        TYPE_ID: 1, // Meeting
        SUBJECT: subject,
        DESCRIPTION: description,
        DESCRIPTION_TYPE: 1,
        DIRECTION: 0,
        START_TIME: startTime,
        END_TIME: endTime,
        RESPONSIBLE_ID: 0,
      },
    });
    return { success: true, action: "meeting", bitrixId, message: `Reunión agendada: ${subject}`, responseData: data };
  } catch (err) {
    return { success: false, action: "meeting", bitrixId, message: `Error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ─── Change lead status ───
export async function changeLeadStatus(
  bitrixId: number,
  statusId: string
): Promise<BitrixActionResult> {
  try {
    const data = await bitrixCall("crm.lead.update", {
      id: bitrixId,
      fields: { STATUS_ID: statusId },
    });
    return { success: true, action: "status_change", bitrixId, message: `Estado actualizado a ${statusId}`, responseData: data };
  } catch (err) {
    return { success: false, action: "status_change", bitrixId, message: `Error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ─── Assign lead to employee ───
export async function assignLead(
  bitrixId: number,
  assignedById: number
): Promise<BitrixActionResult> {
  try {
    const data = await bitrixCall("crm.lead.update", {
      id: bitrixId,
      fields: { ASSIGNED_BY_ID: assignedById },
    });
    return { success: true, action: "assign", bitrixId, message: `Lead asignado a usuario ${assignedById}`, responseData: data };
  } catch (err) {
    return { success: false, action: "assign", bitrixId, message: `Error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ─── Utility: Build WhatsApp deep link ───
export function whatsappLink(phone: string, message: string): string {
  const cleaned = phone.replace(/[^0-9+]/g, "");
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
}

// ─── Utility: Build mailto link ───
export function mailtoLink(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
