/**
 * S.I.P.A. Notification Dispatch System
 *
 * Sends alerts to configured channels: browser notifications, email (via mailto),
 * and WhatsApp (via wa.me links). Respects quiet hours and severity filters.
 */

import type { SIPAAlert, SIPANotificationConfig, SIPAAlertSeverity } from "@/types/sipa";

const SEVERITY_ORDER: SIPAAlertSeverity[] = ["info", "warning", "critical"];

function severityRank(s: SIPAAlertSeverity): number {
  return SEVERITY_ORDER.indexOf(s);
}

function isInQuietHours(config: SIPANotificationConfig): boolean {
  if (!config.quiet_hours) return false;
  const now = new Date();
  const hhmm = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  const { start, end } = config.quiet_hours;

  if (start <= end) {
    return hhmm >= start && hhmm < end;
  }
  // Overnight range (e.g. 22:00 - 07:00)
  return hhmm >= start || hhmm < end;
}

/**
 * Dispatch alerts to configured channels.
 * Returns the list of channels that were notified for each alert.
 */
export function dispatchAlerts(
  alerts: SIPAAlert[],
  config: SIPANotificationConfig
): SIPAAlert[] {
  if (!config.enabled) return alerts;
  if (isInQuietHours(config)) return alerts;

  const minRank = severityRank(config.min_severity);
  const eligibleAlerts = alerts.filter(
    (a) => !a.read && severityRank(a.severity) >= minRank
  );

  if (eligibleAlerts.length === 0) return alerts;

  const notifiedChannels: string[] = [];

  // Browser notifications
  if (config.channels.includes("browser")) {
    fireBrowserBatch(eligibleAlerts);
    notifiedChannels.push("browser");
  }

  // Email (opens mailto: in background — best effort for SPA)
  if (config.channels.includes("email") && config.email_recipients.length > 0) {
    sendEmailDigest(eligibleAlerts, config.email_recipients);
    notifiedChannels.push("email");
  }

  // WhatsApp (generates wa.me links)
  if (config.channels.includes("whatsapp") && config.whatsapp_numbers.length > 0) {
    // WhatsApp only for critical alerts to avoid spam
    const criticalOnly = eligibleAlerts.filter((a) => a.severity === "critical");
    if (criticalOnly.length > 0) {
      sendWhatsAppDigest(criticalOnly, config.whatsapp_numbers);
      notifiedChannels.push("whatsapp");
    }
  }

  // Update alerts with notified channels
  return alerts.map((a) => {
    const wasNotified = eligibleAlerts.some((e) => e.id === a.id);
    if (wasNotified) {
      return {
        ...a,
        notified_channels: [...new Set([...a.notified_channels, ...notifiedChannels])],
      };
    }
    return a;
  });
}

// ─── Browser Notifications ───

function fireBrowserBatch(alerts: SIPAAlert[]): void {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  if (alerts.length <= 3) {
    for (const alert of alerts) {
      new Notification(`S.I.P.A. — ${alert.lead_name}`, {
        body: alert.message.slice(0, 200),
        icon: "/ecs-logo-192.png",
        tag: `sipa-${alert.id}`,
      });
    }
  } else {
    new Notification("S.I.P.A. — Alertas Proactivas", {
      body: `${alerts.length} nuevas alertas requieren atención. Revisa el panel SIPA.`,
      icon: "/ecs-logo-192.png",
      tag: "sipa-batch",
    });
  }
}

// ─── Email (mailto: based — opens default mail client) ───

function sendEmailDigest(alerts: SIPAAlert[], recipients: string[]): void {
  const subject = encodeURIComponent(
    `[S.I.P.A.] ${alerts.length} alerta(s) proactiva(s) — ${new Date().toLocaleDateString("es-CR")}`
  );

  const body = encodeURIComponent(
    alerts
      .map(
        (a) =>
          `🔔 ${a.severity.toUpperCase()} — ${a.lead_name}\n${a.title}\n${a.message}\n`
      )
      .join("\n---\n\n") +
    "\n\n— S.I.P.A. (Sentiment Interaction Proactive Alerting)\nECS Lead Intelligence — ARA Group"
  );

  const to = recipients.join(",");
  const mailtoUrl = `mailto:${to}?subject=${subject}&body=${body}`;

  // Open in hidden iframe to avoid navigation
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = mailtoUrl;
  document.body.appendChild(iframe);
  setTimeout(() => iframe.remove(), 5000);
}

// ─── WhatsApp (wa.me links — opens WhatsApp Web/App) ───

function sendWhatsAppDigest(alerts: SIPAAlert[], numbers: string[]): void {
  const message = encodeURIComponent(
    `🚨 *S.I.P.A. — Alertas Críticas*\n\n` +
    alerts
      .slice(0, 5)
      .map((a) => `⚠️ *${a.lead_name}*: ${a.title}`)
      .join("\n") +
    (alerts.length > 5 ? `\n\n... y ${alerts.length - 5} más` : "") +
    `\n\n🔗 Revisa el panel SIPA en ECS`
  );

  // Open first number only (to avoid popup blocking)
  if (numbers.length > 0) {
    const cleanNumber = numbers[0].replace(/\D/g, "");
    window.open(`https://wa.me/${cleanNumber}?text=${message}`, "_blank");
  }
}

// ─── Permission Request ───

export function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return Promise.resolve("denied" as NotificationPermission);
  return Notification.requestPermission();
}

export function getBrowserNotificationPermission(): NotificationPermission {
  if (!("Notification" in window)) return "denied";
  return Notification.permission;
}
