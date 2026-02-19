import { create } from "zustand";
import type { Segment, LeadStatus } from "@/types/ecs";

interface FilterState {
  search: string;
  segments: Segment[];
  statuses: LeadStatus[];
  channels: string[];
  brands: string[];
  employees: string[];
  scoreRange: [number, number];
  dateRange: [string | null, string | null];
  sortBy: string;
  sortDir: "asc" | "desc";
  page: number;
  pageSize: number;

  setSearch: (search: string) => void;
  setSegments: (segments: Segment[]) => void;
  setStatuses: (statuses: LeadStatus[]) => void;
  setChannels: (channels: string[]) => void;
  setBrands: (brands: string[]) => void;
  setEmployees: (employees: string[]) => void;
  setScoreRange: (range: [number, number]) => void;
  setDateRange: (range: [string | null, string | null]) => void;
  setSortBy: (sortBy: string) => void;
  setSortDir: (sortDir: "asc" | "desc") => void;
  setPage: (page: number) => void;
  resetFilters: () => void;
}

const initialState = {
  search: "",
  segments: [] as Segment[],
  statuses: [] as LeadStatus[],
  channels: [] as string[],
  brands: [] as string[],
  employees: [] as string[],
  scoreRange: [0, 100] as [number, number],
  dateRange: [null, null] as [string | null, string | null],
  sortBy: "current_score",
  sortDir: "desc" as const,
  page: 1,
  pageSize: 50,
};

export const useFilterStore = create<FilterState>()((set) => ({
  ...initialState,
  setSearch: (search) => set({ search, page: 1 }),
  setSegments: (segments) => set({ segments, page: 1 }),
  setStatuses: (statuses) => set({ statuses, page: 1 }),
  setChannels: (channels) => set({ channels, page: 1 }),
  setBrands: (brands) => set({ brands, page: 1 }),
  setEmployees: (employees) => set({ employees, page: 1 }),
  setScoreRange: (scoreRange) => set({ scoreRange, page: 1 }),
  setDateRange: (dateRange) => set({ dateRange, page: 1 }),
  setSortBy: (sortBy) => set({ sortBy }),
  setSortDir: (sortDir) => set({ sortDir }),
  setPage: (page) => set({ page }),
  resetFilters: () => set(initialState),
}));
