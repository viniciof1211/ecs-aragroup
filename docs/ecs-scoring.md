# ECS Scoring Engine

## Overview

The Engagement Continuum Score (ECS) is a composite metric (0–100) that quantifies lead engagement across five dimensions. It is computed entirely client-side in `src/lib/ecs-engine.ts`.

## Score Dimensions

| Dimension | Max Points | What It Measures |
|-----------|-----------|-----------------|
| **Recency** | 25 | How recently the lead interacted (exponential decay) |
| **Frequency** | 25 | Number of interactions weighted by type |
| **Depth** | 25 | Quality/depth of interactions (meetings > emails > calls) |
| **Channel Diversity** | 15 | Number of distinct communication channels used |
| **Velocity** | 10 | Rate of score change / acceleration of engagement |

**Total = min(Recency + Frequency + Depth + ChannelDiversity + Velocity, 100)**

## Decay Model

- **Half-life**: Configurable via `DECAY_HALF_LIFE_DAYS` (default: 30 days)
- **Formula**: `score × 2^(-daysSinceInteraction / halfLife)`
- Recency score decays exponentially from the last interaction timestamp
- Ensures dormant leads naturally lose score over time without manual intervention

## Interaction Weights

Each interaction type has a configurable weight in `INTERACTION_WEIGHTS`:

| Type | Weight | Rationale |
|------|--------|-----------|
| Meeting / Showroom Visit | Highest | In-person = strongest signal |
| Phone Call | High | Direct verbal engagement |
| WhatsApp Message | Medium | Active digital engagement |
| Email | Medium-Low | Asynchronous, lower commitment |
| Form Submission | Low | Passive, one-way |
| Bitrix Status Change | Minimal | System event, not direct engagement |

## Segments

Leads are bucketed into segments based on their ECS score:

| Segment | Score Range | Color | Description |
|---------|------------|-------|-------------|
| **Champion** | 80–100 | Emerald | Highly engaged, ready to close |
| **Hot** | 60–79 | Orange | Active engagement, high potential |
| **Warm** | 40–59 | Amber | Moderate engagement |
| **Cold** | 20–39 | Blue | Low engagement, needs nurturing |
| **Dormant** | 0–19 | Slate | Inactive, at risk of loss |

## Radar Chart Normalization

The score breakdown radar chart normalizes each dimension to a 0–100% scale so all axes are comparable despite different max values:

```
pct = (value / max) × 100
```

This ensures Velocidad (5/10 = 50%) renders the same visual proportion as Recencia (12.5/25 = 50%), rather than plotting raw values on a shared [0, 25] axis which would distort dimensions with smaller maximums.

## Sentiment Bonus

When AI sentiment analysis is available, an `ecs_sentiment_bonus` (±5 points) is added to the total score. This bonus reflects the AI's assessment of the lead's sentiment trajectory and is recalculated on each analysis run.
