# Scoring & Tiers

Owns how a campaign becomes a score (0–1) and a tier. Every value below is the current `intelligence-engine.ts` value. Editing them changes scoring across the app.

## How scoring works

A campaign is scored **only within its cohort** — peers with the same `objective` and `jtd` that passed the significance gates (`02-significance-gates.md`). For each metric in the objective's rule set, the campaign's raw value is min–max normalized across the cohort; `lower`-is-better metrics are inverted (`1 − normalized`); a cohort where every value is identical yields `0.5`. Each normalized metric is multiplied by its weight, and the weighted sum is the composite score. Weights per objective sum to 1.0.

`conversions` is a volume proxy: for the `traffic` objective it reads landing-page views; for every other objective it reads conversions.

## Tier assignment (exact logic)

1. Pick the cost metric: `traffic → costPerLpv`, `awareness → costPerThousandReached`, else `cpa`.
2. Compute the cohort median of that cost. `ownCost` is the campaign's own cost (or infinity if missing).
3. **Cost guard.** For non-sales objectives the guard passes when `ownCost ≤ median × costGuardMultiplier`. For sales the guard is the **ROAS guard** instead: `roas ≥ cohortMedianRoas × salesRoasMultiplier`.
4. Base tier from score: `≥ winner` **and** cost guard passes **and** tracking not `critical` → **winner**; else `≥ contender` → **contender**; else `≥ underperformer` → **underperformer**; else → **kill_candidate**.
5. **Hard kill:** if `ownCost > median × killCostMultiplier` and cohort ≥ `minForRelativeScoring`, force **kill_candidate**.
6. **Small-cohort softening:** if cohort < `minForRelativeScoring`, a **winner** is demoted to **contender** and a **kill_candidate** is softened to **underperformer** (not enough peers to make a strong call).

Campaigns that fail any significance gate never receive a score or tier — they are `insufficient_data`.

## Nuance flags (annotations, not score inputs)

- `tracking_gap` when tracking quality is `critical`.
- `audience_saturation` when frequency exceeds `frequencySaturationThreshold`.
- `small_cohort` when cohort < `minForRelativeScoring`.

## Currency note (read before you scale this cross-account)

The scoring itself is currency-safe because it's **relative within a cohort** — a PKR campaign is only ever compared to other PKR campaigns in the same objective/jtd. The danger is mixing currencies *inside one cohort*. When AdPilot goes multi-account, cohorts must be keyed by currency too, or normalized to a common unit before scoring. Until then, keep one currency per audited account.

## Canonical config

```json
{
  "metricRules": {
    "sales": [
      { "key": "roas", "weight": 0.35, "direction": "higher" },
      { "key": "cpa", "weight": 0.25, "direction": "lower" },
      { "key": "cvr", "weight": 0.15, "direction": "higher" },
      { "key": "conversions", "weight": 0.15, "direction": "higher" },
      { "key": "ctr", "weight": 0.10, "direction": "higher" }
    ],
    "leads": [
      { "key": "cpa", "weight": 0.45, "direction": "lower" },
      { "key": "conversions", "weight": 0.30, "direction": "higher" },
      { "key": "cvr", "weight": 0.15, "direction": "higher" },
      { "key": "ctr", "weight": 0.10, "direction": "higher" }
    ],
    "traffic": [
      { "key": "costPerLpv", "weight": 0.40, "direction": "lower" },
      { "key": "lpvRate", "weight": 0.20, "direction": "higher" },
      { "key": "ctr", "weight": 0.15, "direction": "higher" },
      { "key": "conversions", "weight": 0.25, "direction": "higher" }
    ],
    "awareness": [
      { "key": "costPerThousandReached", "weight": 0.50, "direction": "lower" },
      { "key": "frequency", "weight": 0.20, "direction": "lower" },
      { "key": "ctr", "weight": 0.30, "direction": "higher" }
    ]
  },
  "tierThresholds": { "winner": 0.75, "contender": 0.55, "underperformer": 0.30 },
  "guards": { "salesRoasMultiplier": 1.2, "costGuardMultiplier": 0.8, "killCostMultiplier": 2.0 },
  "cohort": { "minForRelativeScoring": 5 },
  "nuance": { "frequencySaturationThreshold": 2.1 },
  "normalization": { "method": "min_max", "tieValue": 0.5 }
}
```
