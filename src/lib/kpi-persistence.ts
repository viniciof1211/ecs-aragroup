import { supabase } from "./supabase";
import type { CustomKPIDefinition, EmployeeKPISnapshot } from "@/types/employee-kpi";

const LS_KPI_DEFS = "ecs-custom-kpis";
const LS_KPI_SNAPSHOTS = "ecs-kpi-snapshots";

function isSupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL ?? "";
  return url !== "" && !url.includes("your-project");
}

// ─── KPI Definitions CRUD ───

export async function fetchKPIDefinitions(): Promise<CustomKPIDefinition[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from("custom_kpi_definitions")
        .select("*")
        .order("created_at", { ascending: true });
      if (!error && data) return data as CustomKPIDefinition[];
    } catch { /* fallback */ }
  }
  const raw = localStorage.getItem(LS_KPI_DEFS);
  return raw ? JSON.parse(raw) : [];
}

export async function saveKPIDefinition(kpi: CustomKPIDefinition): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from("custom_kpi_definitions")
        .upsert(kpi, { onConflict: "id" });
      if (!error) return;
    } catch { /* fallback */ }
  }
  const existing = await fetchKPIDefinitions();
  const idx = existing.findIndex((k) => k.id === kpi.id);
  if (idx >= 0) existing[idx] = kpi;
  else existing.push(kpi);
  localStorage.setItem(LS_KPI_DEFS, JSON.stringify(existing));
}

export async function deleteKPIDefinition(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from("custom_kpi_definitions")
        .delete()
        .eq("id", id);
      if (!error) {
        // Also delete snapshots for this KPI
        await supabase.from("employee_kpi_snapshots").delete().eq("kpi_id", id);
        return;
      }
    } catch { /* fallback */ }
  }
  const existing = await fetchKPIDefinitions();
  const filtered = existing.filter((k) => k.id !== id);
  localStorage.setItem(LS_KPI_DEFS, JSON.stringify(filtered));
  // Also clean snapshots
  const snaps = await fetchKPISnapshots();
  const filteredSnaps = snaps.filter((s) => s.kpi_id !== id);
  localStorage.setItem(LS_KPI_SNAPSHOTS, JSON.stringify(filteredSnaps));
}

// ─── KPI Snapshots (Historical) ───

export async function fetchKPISnapshots(
  employeeName?: string,
  kpiId?: string
): Promise<EmployeeKPISnapshot[]> {
  if (isSupabaseConfigured()) {
    try {
      let query = supabase
        .from("employee_kpi_snapshots")
        .select("*")
        .order("snapshot_date", { ascending: true });
      if (employeeName) query = query.eq("employee_name", employeeName);
      if (kpiId) query = query.eq("kpi_id", kpiId);
      const { data, error } = await query;
      if (!error && data) return data as EmployeeKPISnapshot[];
    } catch { /* fallback */ }
  }
  const raw = localStorage.getItem(LS_KPI_SNAPSHOTS);
  let all: EmployeeKPISnapshot[] = raw ? JSON.parse(raw) : [];
  if (employeeName) all = all.filter((s) => s.employee_name === employeeName);
  if (kpiId) all = all.filter((s) => s.kpi_id === kpiId);
  return all;
}

export async function saveKPISnapshots(snapshots: EmployeeKPISnapshot[]): Promise<void> {
  if (snapshots.length === 0) return;
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from("employee_kpi_snapshots")
        .upsert(snapshots, { onConflict: "id" });
      if (!error) return;
    } catch { /* fallback */ }
  }
  const existing = await fetchKPISnapshots();
  const existingIds = new Set(existing.map((s) => s.id));
  for (const snap of snapshots) {
    if (existingIds.has(snap.id)) {
      const idx = existing.findIndex((s) => s.id === snap.id);
      if (idx >= 0) existing[idx] = snap;
    } else {
      existing.push(snap);
    }
  }
  localStorage.setItem(LS_KPI_SNAPSHOTS, JSON.stringify(existing));
}
