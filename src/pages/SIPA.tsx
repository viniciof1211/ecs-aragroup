/**
 * S.I.P.A. — Sentiment Interaction Proactive Alerting
 *
 * Full-page view with:
 *   1. Alert feed (real-time alerts with severity badges)
 *   2. Calendar view (monthly grid of appointments/actions)
 *   3. Gantt timeline (horizontal bar chart of all actions per lead)
 *   4. Lead drill-down (click a lead to see all interactions + AI analysis)
 *   5. Notification settings (email, browser, WhatsApp config)
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, BellRing, Calendar as CalendarIcon, GanttChart, Search,
  ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock,
  AlertTriangle, Info, Loader2, Play, Square, Trash2,
  Mail, MessageCircle, Monitor, Settings2,
  Eye, ChevronDown, ChevronUp, ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSIPAStore } from "@/stores/useSIPAStore";
import { useSIPAPolling } from "@/hooks/useSIPAPolling";
import {
  requestBrowserNotificationPermission,
  getBrowserNotificationPermission,
} from "@/lib/sipa-notifications";
import {
  SIPA_ACTION_LABELS,
  SIPA_PRIORITY_LABELS,
  SIPA_PRIORITY_COLORS,
  SIPA_SEVERITY_COLORS,
} from "@/types/sipa";
import type {
  SIPAActionItem,
  SIPAAlert,
  SIPALeadAnalysis,
  SIPAAlertSeverity,
  SIPANotificationChannel,
} from "@/types/sipa";
import { cn } from "@/lib/utils";

// ─── Tab Type ───
type SIPATab = "alerts" | "calendar" | "gantt" | "settings";

// ─── Severity icon ───
function SeverityIcon({ severity, className }: { severity: SIPAAlertSeverity; className?: string }) {
  const c = cn("h-4 w-4", className);
  switch (severity) {
    case "critical": return <AlertTriangle className={cn(c, "text-red-500")} />;
    case "warning": return <AlertTriangle className={cn(c, "text-orange-500")} />;
    case "info": return <Info className={cn(c, "text-blue-500")} />;
  }
}

// ─── Priority badge ───
function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-500/10 text-red-600 border-red-200",
    high: "bg-orange-500/10 text-orange-600 border-orange-200",
    medium: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
    low: "bg-green-500/10 text-green-600 border-green-200",
  };
  return (
    <Badge variant="outline" className={cn("text-[10px]", colors[priority] ?? "")}>
      {SIPA_PRIORITY_LABELS[priority as keyof typeof SIPA_PRIORITY_LABELS] ?? priority}
    </Badge>
  );
}

// ─── Main Component ───
export default function SIPAPage() {
  const store = useSIPAStore();
  const { runNow, cancel } = useSIPAPolling();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SIPATab>("alerts");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Stats
  const analysisCount = Object.keys(store.analyses).length;
  const unreadAlerts = store.alerts.filter((a) => !a.read).length;
  const totalActions = useMemo(() =>
    Object.values(store.analyses).reduce(
      (sum, a) => sum + a.action_items.filter((i) => !i.completed && !i.dismissed).length,
      0
    ),
    [store.analyses]
  );

  // All action items across all leads, sorted by due date
  const allActionItems = useMemo(() => {
    const items: (SIPAActionItem & { analyzed_at: string })[] = [];
    for (const analysis of Object.values(store.analyses)) {
      for (const item of analysis.action_items) {
        if (!item.dismissed) {
          items.push({ ...item, analyzed_at: analysis.analyzed_at });
        }
      }
    }
    return items.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
  }, [store.analyses]);

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    if (!searchQuery) return store.alerts;
    const q = searchQuery.toLowerCase();
    return store.alerts.filter(
      (a) =>
        a.lead_name.toLowerCase().includes(q) ||
        a.title.toLowerCase().includes(q) ||
        a.message.toLowerCase().includes(q) ||
        (a.employee ?? "").toLowerCase().includes(q)
    );
  }, [store.alerts, searchQuery]);

  // ─── TABS ───
  const tabs: { id: SIPATab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: "alerts", label: "Alertas", icon: BellRing, badge: unreadAlerts },
    { id: "calendar", label: "Calendario", icon: CalendarIcon },
    { id: "gantt", label: "Timeline", icon: GanttChart },
    { id: "settings", label: "Configuración", icon: Settings2 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            S.I.P.A.
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sentiment Interaction Proactive Alerting — Sistema de alertas proactivas basado en IA
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Stats badges */}
          <Badge variant="outline" className="gap-1">
            <Eye className="h-3 w-3" /> {analysisCount} leads analizados
          </Badge>
          <Badge variant="outline" className="gap-1 text-orange-600 border-orange-200">
            <Clock className="h-3 w-3" /> {totalActions} acciones pendientes
          </Badge>
          {store.lastRunAt && (
            <span className="text-xs text-muted-foreground">
              Último: {new Date(store.lastRunAt).toLocaleTimeString("es-CR")}
            </span>
          )}
          {/* Run / Cancel */}
          {store.isRunning ? (
            <Button variant="destructive" size="sm" onClick={cancel}>
              <Square className="h-4 w-4 mr-1" /> Detener
            </Button>
          ) : (
            <Button variant="default" size="sm" onClick={runNow}>
              <Play className="h-4 w-4 mr-1" /> Analizar ahora
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {store.isRunning && store.progress && (
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-3 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>
              Analizando leads... {store.progress.done}/{store.progress.total}
              {store.progress.failed > 0 && ` (${store.progress.failed} fallidos)`}
            </span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{
                width: `${store.progress.total > 0 ? (store.progress.done / store.progress.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.badge != null && tab.badge > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-5 text-[10px] px-1">
                {tab.badge}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* ─── ALERTS TAB ─── */}
      {activeTab === "alerts" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Alert Feed */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar alertas por lead, vendedor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              {unreadAlerts > 0 && (
                <Button variant="outline" size="sm" onClick={() => store.markAllAlertsRead()}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Marcar todas leídas
                </Button>
              )}
            </div>

            <ScrollArea className="h-[600px]">
              {filteredAlerts.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No hay alertas{searchQuery ? " que coincidan" : ""}</p>
                  <p className="text-xs mt-1">Las alertas se generarán automáticamente cada 4 minutos</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAlerts.map((alert) => (
                    <AlertCard
                      key={alert.id}
                      alert={alert}
                      expanded={expandedAlerts.has(alert.id)}
                      onToggle={() => {
                        const next = new Set(expandedAlerts);
                        if (next.has(alert.id)) next.delete(alert.id);
                        else next.add(alert.id);
                        setExpandedAlerts(next);
                        if (!alert.read) store.markAlertRead(alert.id);
                      }}
                      onDismiss={() => store.dismissAlert(alert.id)}
                      onViewLead={() => {
                        setSelectedLeadId(alert.lead_id);
                        navigate(`/leads/${alert.lead_id}`);
                      }}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Action Items Sidebar */}
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-500" />
                Acciones Pendientes ({totalActions})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[560px]">
                {allActionItems.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Sin acciones pendientes</p>
                ) : (
                  <div className="space-y-2">
                    {allActionItems.slice(0, 50).map((item) => (
                      <ActionItemCard
                        key={item.id}
                        item={item}
                        onComplete={() => store.completeActionItem(item.lead_id, item.id)}
                        onDismiss={() => store.dismissActionItem(item.lead_id, item.id)}
                        onViewLead={() => navigate(`/leads/${item.lead_id}`)}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── CALENDAR TAB ─── */}
      {activeTab === "calendar" && (
        <CalendarView
          actionItems={allActionItems}
          month={calendarMonth}
          onMonthChange={setCalendarMonth}
          onItemClick={(item) => navigate(`/leads/${item.lead_id}`)}
        />
      )}

      {/* ─── GANTT TAB ─── */}
      {activeTab === "gantt" && (
        <GanttView
          analyses={store.analyses}
          onLeadClick={(leadId) => navigate(`/leads/${leadId}`)}
        />
      )}

      {/* ─── SETTINGS TAB ─── */}
      {activeTab === "settings" && (
        <NotificationSettings
          config={store.notificationConfig}
          onUpdate={(partial) => store.setNotificationConfig(partial)}
          onClearAll={() => store.clearAll()}
        />
      )}
    </div>
  );
}

// ─── Alert Card Component ───

function AlertCard({
  alert,
  expanded,
  onToggle,
  onDismiss,
  onViewLead,
}: {
  alert: SIPAAlert;
  expanded: boolean;
  onToggle: () => void;
  onDismiss: () => void;
  onViewLead: () => void;
}) {
  const borderColor = SIPA_SEVERITY_COLORS[alert.severity];
  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors cursor-pointer",
        alert.read ? "bg-card" : "bg-primary/5 border-l-4"
      )}
      style={alert.read ? {} : { borderLeftColor: borderColor }}
      onClick={onToggle}
    >
      <div className="flex items-start gap-2">
        <SeverityIcon severity={alert.severity} className="mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("text-sm font-medium", !alert.read && "font-semibold")}>
              {alert.title}
            </span>
            {!alert.read && (
              <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
            <span>{alert.lead_name}</span>
            {alert.employee && <span>• {alert.employee}</span>}
            <span>• {new Date(alert.created_at).toLocaleString("es-CR", { dateStyle: "short", timeStyle: "short" })}</span>
          </div>
          {expanded && (
            <div className="mt-2 space-y-2">
              <p className="text-sm text-muted-foreground">{alert.message}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onViewLead(); }}>
                  <ExternalLink className="h-3 w-3 mr-1" /> Ver Lead
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); onDismiss(); }}>
                  <Trash2 className="h-3 w-3 mr-1" /> Descartar
                </Button>
              </div>
            </div>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </div>
    </div>
  );
}

// ─── Action Item Card ───

function ActionItemCard({
  item,
  onComplete,
  onDismiss,
  onViewLead,
}: {
  item: SIPAActionItem;
  onComplete: () => void;
  onDismiss: () => void;
  onViewLead: () => void;
}) {
  const isOverdue = !item.completed && new Date(item.due_date) < new Date();
  return (
    <div className={cn(
      "rounded-md border p-2.5 text-sm",
      item.completed && "opacity-50",
      isOverdue && !item.completed && "border-red-300 bg-red-500/5"
    )}>
      <div className="flex items-start gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onComplete(); }}
          className={cn(
            "mt-0.5 shrink-0 h-4 w-4 rounded-full border-2 transition-colors",
            item.completed ? "bg-green-500 border-green-500" : "border-muted-foreground hover:border-primary"
          )}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn("font-medium", item.completed && "line-through")}>{item.title}</span>
            <PriorityBadge priority={item.priority} />
            <Badge variant="outline" className="text-[9px]">
              {SIPA_ACTION_LABELS[item.type] ?? item.type}
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
            <span
              className="hover:underline cursor-pointer text-primary"
              onClick={(e) => { e.stopPropagation(); onViewLead(); }}
            >
              {item.lead_name}
            </span>
            {item.employee && <span>• {item.employee}</span>}
            <span className={cn(isOverdue && "text-red-500 font-medium")}>
              • {isOverdue ? "⚠️ " : ""}{new Date(item.due_date).toLocaleDateString("es-CR")}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className="text-muted-foreground hover:text-destructive shrink-0"
          title="Descartar"
        >
          <XCircle className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Calendar View ───

function CalendarView({
  actionItems,
  month,
  onMonthChange,
  onItemClick,
}: {
  actionItems: SIPAActionItem[];
  month: Date;
  onMonthChange: (d: Date) => void;
  onItemClick: (item: SIPAActionItem) => void;
}) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const firstDay = new Date(year, m, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Group items by date
  const itemsByDate = useMemo(() => {
    const map: Record<string, SIPAActionItem[]> = {};
    for (const item of actionItems) {
      if (!item.completed && !item.dismissed) {
        const d = item.due_date.slice(0, 10);
        if (!map[d]) map[d] = [];
        map[d].push(item);
      }
    }
    return map;
  }, [actionItems]);

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const monthLabel = new Date(year, m).toLocaleDateString("es-CR", { month: "long", year: "numeric" });

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2 capitalize">
            <CalendarIcon className="h-5 w-5 text-primary" />
            {monthLabel}
          </CardTitle>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onMonthChange(new Date(year, m - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => onMonthChange(new Date(today.getFullYear(), today.getMonth(), 1))}>
              Hoy
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onMonthChange(new Date(year, m + 1, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
          {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((d) => (
            <div key={d} className="bg-muted/50 p-2 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
          {days.map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} className="bg-card min-h-[80px]" />;
            const dateStr = `${year}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const items = itemsByDate[dateStr] ?? [];
            const isToday = dateStr === todayStr;

            return (
              <div
                key={dateStr}
                className={cn(
                  "bg-card min-h-[80px] p-1 transition-colors",
                  isToday && "ring-2 ring-primary ring-inset"
                )}
              >
                <span className={cn(
                  "text-xs font-medium",
                  isToday ? "text-primary font-bold" : "text-muted-foreground"
                )}>
                  {day}
                </span>
                <div className="mt-0.5 space-y-0.5">
                  {items.slice(0, 3).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => onItemClick(item)}
                      className="w-full text-left rounded px-1 py-0.5 text-[10px] truncate transition-colors hover:opacity-80"
                      style={{ backgroundColor: SIPA_PRIORITY_COLORS[item.priority] + "20", color: SIPA_PRIORITY_COLORS[item.priority] }}
                      title={`${item.lead_name}: ${item.title}`}
                    >
                      {item.lead_name.split(" ")[0]}: {SIPA_ACTION_LABELS[item.type] ?? item.type}
                    </button>
                  ))}
                  {items.length > 3 && (
                    <span className="text-[9px] text-muted-foreground px-1">+{items.length - 3} más</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Gantt View ───

function GanttView({
  analyses,
  onLeadClick,
}: {
  analyses: Record<string, SIPALeadAnalysis>;
  onLeadClick: (leadId: string) => void;
}) {
  const [searchQ, setSearchQ] = useState("");

  // Build Gantt data: one row per lead, bars for each action item
  const ganttData = useMemo(() => {
    const rows: Array<{
      lead_id: string;
      lead_name: string;
      health_score: number;
      risk_level: string;
      items: SIPAActionItem[];
    }> = [];

    for (const analysis of Object.values(analyses)) {
      const activeItems = analysis.action_items.filter((i) => !i.dismissed);
      if (activeItems.length === 0) continue;
      if (searchQ) {
        const q = searchQ.toLowerCase();
        if (
          !analysis.lead_name.toLowerCase().includes(q) &&
          !activeItems.some((i) => i.title.toLowerCase().includes(q) || (i.employee ?? "").toLowerCase().includes(q))
        ) continue;
      }
      rows.push({
        lead_id: analysis.lead_id,
        lead_name: analysis.lead_name,
        health_score: analysis.health_score,
        risk_level: analysis.risk_level,
        items: activeItems.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()),
      });
    }

    return rows.sort((a, b) => a.health_score - b.health_score); // worst health first
  }, [analyses, searchQ]);

  // Date range for the timeline
  const { minDate, totalDays } = useMemo(() => {
    const today = new Date();
    let min = today;
    let max = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days ahead

    for (const row of ganttData) {
      for (const item of row.items) {
        const d = new Date(item.due_date);
        if (d < min) min = d;
        if (d > max) max = d;
      }
    }

    const total = Math.max(1, Math.ceil((max.getTime() - min.getTime()) / (24 * 60 * 60 * 1000)));
    return { minDate: min, maxDate: max, totalDays: total };
  }, [ganttData]);

  function dateToPercent(dateStr: string): number {
    const d = new Date(dateStr);
    const offset = (d.getTime() - minDate.getTime()) / (24 * 60 * 60 * 1000);
    return Math.max(0, Math.min(100, (offset / totalDays) * 100));
  }

  // Generate date markers
  const dateMarkers = useMemo(() => {
    const markers: { label: string; percent: number }[] = [];
    const step = Math.max(1, Math.floor(totalDays / 8));
    for (let i = 0; i <= totalDays; i += step) {
      const d = new Date(minDate.getTime() + i * 24 * 60 * 60 * 1000);
      markers.push({
        label: d.toLocaleDateString("es-CR", { day: "numeric", month: "short" }),
        percent: (i / totalDays) * 100,
      });
    }
    return markers;
  }, [minDate, totalDays]);

  const todayPercent = dateToPercent(new Date().toISOString());

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <GanttChart className="h-5 w-5 text-primary" />
            Timeline de Acciones por Lead ({ganttData.length})
          </CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar lead..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {ganttData.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <GanttChart className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Sin datos de timeline disponibles</p>
            <p className="text-xs mt-1">Ejecuta el análisis SIPA para generar el timeline</p>
          </div>
        ) : (
          <ScrollArea className="h-[600px]">
            {/* Date markers header */}
            <div className="flex mb-2">
              <div className="w-48 shrink-0" />
              <div className="flex-1 relative h-6">
                {dateMarkers.map((m, i) => (
                  <span
                    key={i}
                    className="absolute text-[10px] text-muted-foreground -translate-x-1/2"
                    style={{ left: `${m.percent}%` }}
                  >
                    {m.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Gantt rows */}
            <div className="space-y-1">
              {ganttData.map((row) => (
                <div key={row.lead_id} className="flex items-center group">
                  {/* Lead label */}
                  <button
                    onClick={() => onLeadClick(row.lead_id)}
                    className="w-48 shrink-0 text-left pr-2 truncate text-sm hover:text-primary transition-colors"
                    title={row.lead_name}
                  >
                    <span className="font-medium">{row.lead_name}</span>
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      ({row.health_score}%)
                    </span>
                  </button>

                  {/* Timeline bar */}
                  <div className="flex-1 relative h-8 bg-muted/30 rounded-sm">
                    {/* Today marker */}
                    <div
                      className="absolute top-0 bottom-0 w-px bg-primary/40 z-10"
                      style={{ left: `${todayPercent}%` }}
                    />
                    {/* Action item dots */}
                    {row.items.map((item) => {
                      const left = dateToPercent(item.due_date);
                      return (
                        <div
                          key={item.id}
                          className="absolute top-1 h-6 rounded-sm px-1 flex items-center text-[9px] font-medium text-white truncate cursor-default"
                          style={{
                            left: `${left}%`,
                            width: "clamp(60px, 8%, 120px)",
                            backgroundColor: item.completed ? "#94a3b8" : SIPA_PRIORITY_COLORS[item.priority],
                            opacity: item.completed ? 0.5 : 1,
                          }}
                          title={`${item.title} — ${new Date(item.due_date).toLocaleDateString("es-CR")} — ${item.employee ?? "Sin asignar"}`}
                        >
                          {SIPA_ACTION_LABELS[item.type] ?? item.type}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Notification Settings ───

function NotificationSettings({
  config,
  onUpdate,
  onClearAll,
}: {
  config: import("@/types/sipa").SIPANotificationConfig;
  onUpdate: (partial: Partial<import("@/types/sipa").SIPANotificationConfig>) => void;
  onClearAll: () => void;
}) {
  const [newEmail, setNewEmail] = useState("");
  const [newWhatsApp, setNewWhatsApp] = useState("");
  const browserPermission = getBrowserNotificationPermission();

  const channelOptions: { id: SIPANotificationChannel; label: string; icon: React.ElementType; description: string }[] = [
    { id: "browser", label: "Navegador", icon: Monitor, description: "Notificaciones push del navegador" },
    { id: "email", label: "Email", icon: Mail, description: "Resumen por correo electrónico" },
    { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, description: "Alertas críticas por WhatsApp" },
  ];

  const toggleChannel = (ch: SIPANotificationChannel) => {
    const current = config.channels;
    if (current.includes(ch)) {
      onUpdate({ channels: current.filter((c) => c !== ch) });
    } else {
      onUpdate({ channels: [...current, ch] });
      if (ch === "browser" && browserPermission !== "granted") {
        requestBrowserNotificationPermission();
      }
    }
  };

  const addEmail = () => {
    if (!newEmail || !newEmail.includes("@")) return;
    if (!config.email_recipients.includes(newEmail)) {
      onUpdate({ email_recipients: [...config.email_recipients, newEmail] });
    }
    setNewEmail("");
  };

  const removeEmail = (email: string) => {
    onUpdate({ email_recipients: config.email_recipients.filter((e) => e !== email) });
  };

  const addWhatsApp = () => {
    if (!newWhatsApp) return;
    const clean = newWhatsApp.replace(/\D/g, "");
    if (clean.length < 8) return;
    if (!config.whatsapp_numbers.includes(clean)) {
      onUpdate({ whatsapp_numbers: [...config.whatsapp_numbers, clean] });
    }
    setNewWhatsApp("");
  };

  const removeWhatsApp = (num: string) => {
    onUpdate({ whatsapp_numbers: config.whatsapp_numbers.filter((n) => n !== num) });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Channel Config */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Canales de Notificación
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Master toggle */}
          <label className="flex items-center justify-between cursor-pointer">
            <span className="font-medium">Notificaciones habilitadas</span>
            <button
              onClick={() => onUpdate({ enabled: !config.enabled })}
              className={cn(
                "relative h-6 w-11 rounded-full transition-colors",
                config.enabled ? "bg-primary" : "bg-muted"
              )}
            >
              <span className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                config.enabled ? "translate-x-5" : "translate-x-0.5"
              )} />
            </button>
          </label>

          {/* Channel toggles */}
          {channelOptions.map((ch) => (
            <div key={ch.id} className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <ch.icon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{ch.label}</p>
                  <p className="text-xs text-muted-foreground">{ch.description}</p>
                  {ch.id === "browser" && browserPermission !== "granted" && (
                    <p className="text-xs text-orange-500">Permiso: {browserPermission}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => toggleChannel(ch.id)}
                className={cn(
                  "relative h-6 w-11 rounded-full transition-colors",
                  config.channels.includes(ch.id) ? "bg-primary" : "bg-muted"
                )}
              >
                <span className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                  config.channels.includes(ch.id) ? "translate-x-5" : "translate-x-0.5"
                )} />
              </button>
            </div>
          ))}

          {/* Severity filter */}
          <div>
            <p className="text-sm font-medium mb-2">Severidad mínima</p>
            <div className="flex gap-2">
              {(["info", "warning", "critical"] as const).map((s) => (
                <Button
                  key={s}
                  variant={config.min_severity === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => onUpdate({ min_severity: s })}
                  className="capitalize"
                >
                  {s === "info" ? "Informativa" : s === "warning" ? "Advertencia" : "Crítica"}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recipients */}
      <div className="space-y-6">
        {/* Email recipients */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Destinatarios de Email
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="correo@ejemplo.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addEmail()}
              />
              <Button onClick={addEmail} size="sm">Agregar</Button>
            </div>
            {config.email_recipients.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin destinatarios configurados</p>
            ) : (
              <div className="space-y-1">
                {config.email_recipients.map((email) => (
                  <div key={email} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                    <span className="text-sm">{email}</span>
                    <Button variant="ghost" size="sm" onClick={() => removeEmail(email)}>
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* WhatsApp numbers */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-500" />
              Números de WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                type="tel"
                placeholder="+506 8888-0000"
                value={newWhatsApp}
                onChange={(e) => setNewWhatsApp(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addWhatsApp()}
              />
              <Button onClick={addWhatsApp} size="sm">Agregar</Button>
            </div>
            {config.whatsapp_numbers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin números configurados</p>
            ) : (
              <div className="space-y-1">
                {config.whatsapp_numbers.map((num) => (
                  <div key={num} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                    <span className="text-sm">+{num}</span>
                    <Button variant="ghost" size="sm" onClick={() => removeWhatsApp(num)}>
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Danger zone */}
        <Card className="shadow-card border-destructive/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Limpiar todos los datos SIPA</p>
                <p className="text-xs text-muted-foreground">Elimina todos los análisis, alertas y caché</p>
              </div>
              <Button variant="destructive" size="sm" onClick={onClearAll}>
                <Trash2 className="h-4 w-4 mr-1" /> Limpiar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
