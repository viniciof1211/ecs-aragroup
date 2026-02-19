/**
 * Zustand store for Meta Marketing / Ads Manager data.
 * Holds campaigns, ad sets, ads, posts, time series, and aggregate metrics.
 */
import { create } from "zustand";
import type {
  MetaCampaign,
  MetaAdSet,
  MetaAd,
  MetaPost,
  MetaInsightPoint,
  MetaAggregateMetrics,
  MetaAdRecommendation,
  PostEffectivenessPoint,
} from "@/types/meta-ads";
import {
  fetchCampaigns,
  fetchAdSets,
  fetchAds,
  fetchPagePosts,
  fetchAccountInsightsTimeSeries,
  computeMetaAggregates,
  computePostEffectiveness,
  generateAdRecommendations,
} from "@/lib/meta-api";

interface MetaAdsState {
  // Data
  campaigns: MetaCampaign[];
  adSets: MetaAdSet[];
  ads: MetaAd[];
  posts: MetaPost[];
  timeSeries: MetaInsightPoint[];
  aggregates: MetaAggregateMetrics | null;
  recommendations: MetaAdRecommendation[];
  postEffectiveness: PostEffectivenessPoint[];

  // State
  isLoading: boolean;
  lastFetchAt: Date | null;
  error: string | null;
  fetchCount: number;

  // Actions
  fetchAll: () => Promise<void>;
  setError: (err: string | null) => void;
}

export const useMetaAdsStore = create<MetaAdsState>((set, get) => ({
  campaigns: [],
  adSets: [],
  ads: [],
  posts: [],
  timeSeries: [],
  aggregates: null,
  recommendations: [],
  postEffectiveness: [],

  isLoading: false,
  lastFetchAt: null,
  error: null,
  fetchCount: 0,

  fetchAll: async () => {
    if (get().isLoading) return;
    set({ isLoading: true, error: null });

    try {
      const [campaigns, adSets, ads, posts, timeSeries] = await Promise.all([
        fetchCampaigns(),
        fetchAdSets(),
        fetchAds(),
        fetchPagePosts(),
        fetchAccountInsightsTimeSeries(30),
      ]);

      const aggregates = computeMetaAggregates(campaigns, ads, posts, timeSeries);
      const recommendations = generateAdRecommendations(campaigns, ads, posts, aggregates);
      const postEffectiveness = computePostEffectiveness(posts);

      set({
        campaigns,
        adSets,
        ads,
        posts,
        timeSeries,
        aggregates,
        recommendations,
        postEffectiveness,
        isLoading: false,
        lastFetchAt: new Date(),
        fetchCount: get().fetchCount + 1,
      });

      console.log(
        `[Meta Ads] Fetched: ${campaigns.length} campaigns, ${ads.length} ads, ${posts.length} posts, ${timeSeries.length} data points`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Meta Ads] Fetch error:", msg);
      set({ isLoading: false, error: msg });
    }
  },

  setError: (err) => set({ error: err }),
}));
