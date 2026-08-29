# Objective & Creative Rules

Owns what each objective optimizes for, what it must track, how budget maps to a build tier, which creative angles that tier gets, and which advertiser categories are blocked. Values below are the current `campaign-rules.ts` values, **plus** an `awareness` entry that the code is currently missing (see `00-brain-contract.md`).

## Objective rules

Each objective declares its optimization goal, the primary KPI it's judged on, supporting metrics, tracking that must exist before it can run, and a default call-to-action. These drive both the audit's "are you judging this on the right metric?" logic and the campaign builder's defaults.

- **sales** → Purchase conversions · primary **Cost per purchase** · needs pixel/dataset + verified Purchase event + UTMs · CTA "Shop now".
- **leads** → Qualified leads · primary **Cost per lead** · needs verified Lead event + form/CRM handoff tested + UTMs · CTA "Get quote".
- **traffic** → Landing page views · primary **Cost per landing page view** · needs verified page-view event + analytics session tracking + UTMs · CTA "Learn more".
- **awareness** → Reach · primary **Cost per 1,000 reached** · needs reach/frequency reporting enabled · CTA "Learn more". *(new — keep consistent with the awareness scoring rules.)*

## Budget → build tier → creative angles

Budget tier decides how many distinct creative angles a new build gets, so limited delivery data isn't fragmented across too many ads. Structure is always **one prospecting ad set**; ad count equals the number of angles.

- **LEAN** (< 50/day): angles = Primary benefit, Problem/friction. Concentrate thin data.
- **VALIDATION** (< 150/day): + Use case. Test three messages in one audience.
- **SCALE_READY** (≥ 150/day): + Proof/confidence. Add a proof challenger without fragmenting delivery.

Same USD-shape caveat as the significance gates: these thresholds are currency-blind. Keep the defaults; add per-currency overrides when multi-account lands.

## Blocked categories

Campaigns whose text matches a Meta special-ad or prohibited category are flagged before build. Patterns are stored as source + flags so the loader compiles them to `RegExp`. Categories: politics, housing, employment, credit, medical, gambling.

## Canonical config

```json
{
  "objectiveRules": {
    "sales":     { "optimizationGoal": "Purchase conversions", "primaryMetric": "Cost per purchase", "secondaryMetrics": ["Click-through rate", "Landing page conversion rate", "Return on ad spend"], "trackingRequirements": ["Meta Pixel or Dataset installed", "Purchase event verified", "UTM parameters applied"], "callToAction": "Shop now" },
    "leads":     { "optimizationGoal": "Qualified leads", "primaryMetric": "Cost per lead", "secondaryMetrics": ["Form completion rate", "Qualified lead rate", "Lead-to-sale rate"], "trackingRequirements": ["Lead event verified", "Form or CRM handoff tested", "UTM parameters applied"], "callToAction": "Get quote" },
    "traffic":   { "optimizationGoal": "Landing page views", "primaryMetric": "Cost per landing page view", "secondaryMetrics": ["Outbound click-through rate", "Engaged session rate", "Downstream conversion rate"], "trackingRequirements": ["Page-view event verified", "Analytics session tracking enabled", "UTM parameters applied"], "callToAction": "Learn more" },
    "awareness": { "optimizationGoal": "Reach", "primaryMetric": "Cost per 1,000 reached", "secondaryMetrics": ["Click-through rate", "Frequency"], "trackingRequirements": ["Reach and frequency reporting enabled"], "callToAction": "Learn more" }
  },
  "budgetTiers": [
    { "tier": "LEAN", "maxDailyBudgetExclusive": 50 },
    { "tier": "VALIDATION", "maxDailyBudgetExclusive": 150 },
    { "tier": "SCALE_READY", "maxDailyBudgetExclusive": null }
  ],
  "tierCreativeAngles": {
    "LEAN": ["PRIMARY_BENEFIT", "PROBLEM_FRICTION"],
    "VALIDATION": ["PRIMARY_BENEFIT", "PROBLEM_FRICTION", "USE_CASE"],
    "SCALE_READY": ["PRIMARY_BENEFIT", "PROBLEM_FRICTION", "USE_CASE", "PROOF_CONFIDENCE"]
  },
  "structure": "ONE_PROSPECTING_AD_SET",
  "unsupportedCategories": [
    { "category": "politics",   "pattern": "\\b(political|politics|election|candidate|voting|vote for)\\b", "flags": "i" },
    { "category": "housing",    "pattern": "\\b(housing|real estate listing|apartment rental|home loan|mortgage)\\b", "flags": "i" },
    { "category": "employment", "pattern": "\\b(job opening|recruitment|hiring|employment opportunity)\\b", "flags": "i" },
    { "category": "credit",     "pattern": "\\b(credit repair|credit card|personal loan|payday loan|debt relief|lending)\\b", "flags": "i" },
    { "category": "medical",    "pattern": "\\b(prescription|medical treatment|diagnose|diagnosis|weight loss drug)\\b", "flags": "i" },
    { "category": "gambling",   "pattern": "\\b(gambling|casino|sports betting|betting|lottery)\\b", "flags": "i" }
  ]
}
```
