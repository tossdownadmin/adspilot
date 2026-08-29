# Retrieval & Playbook Synthesis

Owns how a new-campaign brief finds the right historical winners to learn from, and how those winners become a PAUSED, human-reviewable campaign playbook. This is the "create a campaign from what worked" logic. Values below are the current `retrieveReferences()` / `buildIntelligencePlaybook()` values.

Nothing here creates, changes, activates, or spends on Meta. A playbook is a **plan**, always `reviewRequired: true`.

## Reference eligibility

Only campaigns that clear every bar below can be used as references for a new build. This keeps the system from copying a lucky fluke:

- tier is **winner**, and
- cohort size ≥ `minCohort`, and
- JTD confidence ≥ `minJtdConfidence`, and
- tracking quality is **good** (not `critical`), and
- campaign age ≤ `maxAgeDays` (recent winners only).

## Two references, one ladder

- **Closest-best** — walk the specificity ladder from most specific to least, stopping at the first rung that has an eligible match; within a rung, pick the highest score. The ladder never relaxes `objective` — a sales brief only ever learns from sales winners.
- **Overall-best** — the highest-scoring eligible winner matching just `jtd` + `objective`, ignoring region/product.

If the same campaign fills both roles, disclose it and reduce reference-diversity confidence (it's one data point, not two).

## Recommendation mode

- both references exist and differ → **historical_blend**
- both exist and are the same, or only one exists → **single_reference**
- no eligible reference → **cold_start** (deterministic defaults; a contender is *never* silently promoted to winner)

## Budget formula

Start from **half** the closest-best's effective daily spend, capped by the workspace daily cap. A valid user-supplied budget is preserved (and any cap applied is surfaced as a warning, never silent). Cold start uses the user's budget capped by the workspace limit.

## Confidence

Cold start → `coldStart`. Otherwise the mean of the closest-best and overall-best scores, clamped to `[min, max]`, minus `duplicateReferencePenalty` when both references are the same campaign.

## Provenance (required on every playbook field)

Every field in a generated playbook must carry where it came from — `user_brief`, `objective_rule`, `closest_best` (+campaignId), `overall_best` (+campaignId), `workspace_policy`, or a `cold_start_rule` — and what transformation was applied. No field may appear without provenance. This is what lets a human trust the plan and what stops the LLM from smuggling in unsupported claims.

## Canonical config

```json
{
  "eligibility": {
    "requireTier": "winner",
    "minCohort": 5,
    "minJtdConfidence": 0.8,
    "requireTrackingQuality": "good",
    "maxAgeDays": 90
  },
  "closestBestLadder": [
    ["region", "product", "jtd", "objective"],
    ["region", "product", "objective"],
    ["product", "jtd", "objective"],
    ["region", "jtd", "objective"],
    ["jtd", "objective"],
    ["objective"]
  ],
  "overallBestKeys": ["jtd", "objective"],
  "budgetFormula": {
    "fromClosestBestDailySpendFraction": 0.5,
    "workspaceDailyCap": 200,
    "preserveValidUserBudget": true
  },
  "optimizationGoalMap": { "sales": "purchase", "leads": "lead", "traffic": "landing_page_view", "awareness": "reach" },
  "bidStrategy": "lowest_cost",
  "initialStatus": "PAUSED",
  "confidence": { "coldStart": 0.42, "min": 0.5, "max": 0.95, "duplicateReferencePenalty": 0.08 }
}
```
