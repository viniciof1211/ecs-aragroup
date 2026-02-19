import { create } from "zustand";
import type { CustomKPIDefinition, EmployeeKPISnapshot } from "@/types/employee-kpi";
import { BUILTIN_KPIS } from "@/types/employee-kpi";
import {
  fetchKPIDefinitions,
  saveKPIDefinition,
  deleteKPIDefinition as deleteDef,
  fetchKPISnapshots,
  saveKPISnapshots,
} from "@/lib/kpi-persistence";

interface KPIStore {
  customKPIs: CustomKPIDefinition[];
  snapshots: EmployeeKPISnapshot[];
  loading: boolean;

  // All KPIs (built-in + custom)
  allKPIs: () => CustomKPIDefinition[];

  // Actions
  loadKPIs: () => Promise<void>;
  addKPI: (kpi: CustomKPIDefinition) => Promise<void>;
  updateKPI: (kpi: CustomKPIDefinition) => Promise<void>;
  removeKPI: (id: string) => Promise<void>;

  loadSnapshots: (employeeName?: string) => Promise<void>;
  addSnapshots: (snaps: EmployeeKPISnapshot[]) => Promise<void>;
}

export const useKPIStore = create<KPIStore>((set, get) => ({
  customKPIs: [],
  snapshots: [],
  loading: false,

  allKPIs: () => [...BUILTIN_KPIS, ...get().customKPIs],

  loadKPIs: async () => {
    set({ loading: true });
    try {
      const defs = await fetchKPIDefinitions();
      set({ customKPIs: defs });
    } finally {
      set({ loading: false });
    }
  },

  addKPI: async (kpi) => {
    await saveKPIDefinition(kpi);
    set((s) => ({ customKPIs: [...s.customKPIs, kpi] }));
  },

  updateKPI: async (kpi) => {
    await saveKPIDefinition(kpi);
    set((s) => ({
      customKPIs: s.customKPIs.map((k) => (k.id === kpi.id ? kpi : k)),
    }));
  },

  removeKPI: async (id) => {
    await deleteDef(id);
    set((s) => ({
      customKPIs: s.customKPIs.filter((k) => k.id !== id),
      snapshots: s.snapshots.filter((snap) => snap.kpi_id !== id),
    }));
  },

  loadSnapshots: async (employeeName) => {
    const snaps = await fetchKPISnapshots(employeeName);
    set({ snapshots: snaps });
  },

  addSnapshots: async (snaps) => {
    await saveKPISnapshots(snaps);
    set((s) => ({ snapshots: [...s.snapshots, ...snaps] }));
  },
}));
