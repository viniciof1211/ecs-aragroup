import { differenceInDays, differenceInSeconds } from "date-fns";
import type { ECSInteraction, ECSScoreBreakdown, Segment } from "@/types/ecs";

// ─── Interaction Weights ───
export const INTERACTION_WEIGHTS: Record<string, number> = {
  lead_created: 5,
  status_changed: 3,
  note_added: 2,
  call: 8,
  email_sent: 4,
  email_received: 6,
  whatsapp: 7,
  meeting: 10,
  quote_sent: 9,
  deal_won: 15,
  deal_lost: -5,
  form_submitted: 6,
  page_visited: 1,
  chat: 6,
  web_visit: 2,
  showroom_visit: 8,
  facebook_lead: 5,
  stage_change: 3,
  contact_attempt: 4,
  budget_qualified: 7,
  design_request: 9,
};

// ─── Temporal Decay ───
export const DECAY_HALF_LIFE_DAYS = 14;

export function temporalDecay(daysSinceInteraction: number): number {
  return Math.pow(0.5, daysSinceInteraction / DECAY_HALF_LIFE_DAYS);
}

// ─── Score Components ───

function calcRecency(interactions: ECSInteraction[], now: Date): number {
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentInteractions = interactions.filter(
    (i) => new Date(i.timestamp) >= sevenDaysAgo
  );
  const totalWeight = recentInteractions.reduce((sum, i) => {
    const w = INTERACTION_WEIGHTS[i.type] ?? 3;
    return sum + Math.max(w, 0);
  }, 0);
  return Math.min(totalWeight * 1.5, 25);
}

function calcFrequency(interactions: ECSInteraction[]): number {
  return Math.min(interactions.length * 1.5, 25);
}

function calcDepth(interactions: ECSInteraction[], now: Date): number {
  const totalDecayedWeight = interactions.reduce((sum, i) => {
    const w = INTERACTION_WEIGHTS[i.type] ?? 3;
    const days = differenceInDays(now, new Date(i.timestamp));
    const decay = temporalDecay(Math.max(days, 0));
    return sum + w * decay;
  }, 0);
  return Math.min(totalDecayedWeight * 0.8, 25);
}

function calcChannelDiversity(interactions: ECSInteraction[]): number {
  const uniqueChannels = new Set(interactions.map((i) => i.channel));
  return Math.min((uniqueChannels.size - 1) * 5, 15);
}

function calcVelocity(interactions: ECSInteraction[]): number {
  if (interactions.length < 4) return 0;

  const sorted = [...interactions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const mid = Math.floor(sorted.length / 2);
  const oldHalf = sorted.slice(0, mid);
  const newHalf = sorted.slice(mid);

  function avgGap(items: ECSInteraction[]): number {
    if (items.length < 2) return Infinity;
    let totalGap = 0;
    for (let i = 1; i < items.length; i++) {
      totalGap += differenceInSeconds(
        new Date(items[i].timestamp),
        new Date(items[i - 1].timestamp)
      );
    }
    return totalGap / (items.length - 1);
  }

  const oldGap = avgGap(oldHalf);
  const newGap = avgGap(newHalf);

  if (oldGap === Infinity || newGap === Infinity) return 0;

  const acceleration = (oldGap - newGap) / 86400; // convert to days
  return Math.min(Math.max(acceleration * 2, 0), 10);
}

// ─── Main Calculator ───

export function calculateECSScore(
  interactions: ECSInteraction[],
  now: Date = new Date()
): ECSScoreBreakdown {
  if (interactions.length === 0) {
    return { recency: 0, frequency: 0, depth: 0, channelDiversity: 0, velocity: 0, total: 0 };
  }

  const recency = calcRecency(interactions, now);
  const frequency = calcFrequency(interactions);
  const depth = calcDepth(interactions, now);
  const channelDiversity = Math.max(calcChannelDiversity(interactions), 0);
  const velocity = calcVelocity(interactions);

  const total = Math.min(
    Math.round(recency + frequency + depth + channelDiversity + velocity),
    100
  );

  return {
    recency: Math.round(recency * 10) / 10,
    frequency: Math.round(frequency * 10) / 10,
    depth: Math.round(depth * 10) / 10,
    channelDiversity: Math.round(channelDiversity * 10) / 10,
    velocity: Math.round(velocity * 10) / 10,
    total,
  };
}

export function getSegmentFromScore(score: number): Segment {
  if (score >= 80) return "hot";
  if (score >= 60) return "warm";
  if (score >= 40) return "cool";
  if (score >= 20) return "cold";
  if (score >= 5) return "dormant";
  return "lost";
}

export function getScoreTrend(
  current: number,
  previous: number
): "up" | "down" | "stable" {
  const delta = current - previous;
  if (delta > 2) return "up";
  if (delta < -2) return "down";
  return "stable";
}

// ─── Apply Sentiment Bonus ───

export function applySentimentBonus(baseScore: number, sentimentBonus: number): number {
  return Math.round(Math.max(0, Math.min(100, baseScore + sentimentBonus)));
}

// ─── Simple Linear Regression for Forecasting ───

export function linearRegression(
  points: { x: number; y: number }[]
): { slope: number; intercept: number; r2: number } {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0, r2: 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
    sumY2 += p.y * p.y;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const ssTot = sumY2 - (sumY * sumY) / n;
  const ssRes = points.reduce((s, p) => {
    const predicted = slope * p.x + intercept;
    return s + (p.y - predicted) ** 2;
  }, 0);
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { slope, intercept, r2 };
}
