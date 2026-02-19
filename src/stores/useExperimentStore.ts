import { create } from "zustand";
import type { ABTest } from "@/lib/ab-engine";

// ─── Types ───

export type ExperimentStatus = "active" | "paused" | "completed";
export type VariantAssignment = "A" | "B";

export interface EnrolledLead {
  leadId: string;
  leadName: string;
  variant: VariantAssignment;
  enrolledScore: number;
  enrolledStatus: string;
  enrolledSegment: string;
  enrolledAt: string;
}

export interface ExperimentSnapshot {
  date: string;
  variantA: { avgScore: number; count: number; statusChanges: number; improved: number };
  variantB: { avgScore: number; count: number; statusChanges: number; improved: number };
}

export interface Experiment {
  id: string;
  test: ABTest;
  status: ExperimentStatus;
  createdAt: string;
  startedAt: string;
  endsAt: string;
  leads: EnrolledLead[];
  snapshots: ExperimentSnapshot[];
  projections: {
    expectedLiftPct: number;
    expectedConversions: number;
    baselineConversionPct: number;
  };
  notes: string;
}

interface ExperimentState {
  experiments: Experiment[];
  addExperiment: (exp: Experiment) => void;
  updateExperiment: (id: string, patch: Partial<Experiment>) => void;
  removeExperiment: (id: string) => void;
  addSnapshot: (id: string, snapshot: ExperimentSnapshot) => void;
  hydrate: () => void;
}

const STORAGE_KEY = "ecs-ab-experiments";

function persist(experiments: Experiment[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(experiments));
  } catch {
    console.warn("Failed to persist experiments");
  }
}

function load(): Experiment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export const useExperimentStore = create<ExperimentState>()((set, get) => ({
  experiments: [],

  addExperiment: (exp) => {
    const updated = [...get().experiments, exp];
    set({ experiments: updated });
    persist(updated);
  },

  updateExperiment: (id, patch) => {
    const updated = get().experiments.map((e) =>
      e.id === id ? { ...e, ...patch } : e
    );
    set({ experiments: updated });
    persist(updated);
  },

  removeExperiment: (id) => {
    const updated = get().experiments.filter((e) => e.id !== id);
    set({ experiments: updated });
    persist(updated);
  },

  addSnapshot: (id, snapshot) => {
    const updated = get().experiments.map((e) =>
      e.id === id ? { ...e, snapshots: [...e.snapshots, snapshot] } : e
    );
    set({ experiments: updated });
    persist(updated);
  },

  hydrate: () => {
    const cached = load();
    if (cached.length > 0) set({ experiments: cached });
  },
}));

// ─── Helper: generate experiment ID ───
export function generateExperimentId(): string {
  return `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Helper: compute projections from test metadata ───
export function computeProjections(
  test: ABTest,
  enrolledCount: number
): Experiment["projections"] {
  const impactMultiplier =
    test.estimatedImpact === "alto" ? 0.25 :
    test.estimatedImpact === "medio" ? 0.15 : 0.08;

  const baselineConversionPct =
    test.category === "conversion" ? 12 :
    test.category === "reactivation" ? 8 : 18;

  const expectedLiftPct = Math.round(impactMultiplier * 100);
  const leadsPerVariant = Math.ceil(enrolledCount / 2);
  const expectedConversions = Math.round(
    leadsPerVariant * ((baselineConversionPct + baselineConversionPct * impactMultiplier) / 100)
  );

  return { expectedLiftPct, expectedConversions, baselineConversionPct };
}
