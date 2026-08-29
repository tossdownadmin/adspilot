# Campaign Intelligence Playbook Schema V1

## 1. Output formats

The canonical internal format is JSON. YAML is an export representation of the same versioned data.

The exporter must not omit provenance, warnings, or review requirements for convenience.

## 2. Top-level schema

```yaml
schema_version: "1.0"
playbook_id: "pb_..."
generated_at: "2026-08-27T00:00:00Z"
recommendation_mode: "historical_blend" # historical_blend | single_reference | cold_start

source:
  account_id: "act_..."
  account_name: "Example Account"
  currency: "USD"
  timezone: "America/New_York"
  audit_id: "audit_..."
  audit_config_version: "score-v1.0"
  rollup_window:
    start: "2026-07-27"
    end: "2026-08-25"

brief:
  region: "MD-DC"
  product: "pizza"
  objective: "sales"
  jtd: "promote_lto"
  requested_daily_budget: 50
  destination_url: "https://example.com/offer"
  offer_constraints: []
  creative_constraints: []

references:
  closest_best: {}
  overall_best: {}
  references_are_same: false

recommendation:
  campaign: {}
  audience: {}
  creative: {}
  measurement: {}

provenance: {}
evidence_summary: []
assumptions: []
warnings: []
confidence: {}
review: {}
```

## 3. Reference schema

```yaml
campaign_id: "camp_8842"
campaign_name: "DC Summer Bundle"
role: "closest_best"
matched_rung: [region, product, jtd, objective]
composite_score: 0.81
tier: "winner"
jtd: "promote_lto"
jtd_confidence: 0.91
metrics:
  spend: 945
  conversions: 210
  roas: 4.6
  cpa: 4.5
  cvr: 0.038
  ctr: 0.021
evidence_window:
  start: "2026-07-27"
  end: "2026-08-25"
data_quality_flags: []
```

## 4. Recommendation schema

```yaml
campaign:
  name: "MD-DC | pizza | promote_lto | 2026-08-27"
  objective: "sales"
  optimization_goal: "purchase"
  bid_strategy: "lowest_cost"
  initial_status: "PAUSED"
  daily_budget: 45
  currency: "USD"

audience:
  geo: "Washington DC +15mi"
  age_range: "24-54"
  pattern: "broad_local_prospecting"
  interests: ["pizza", "food delivery", "local deals"]
  custom_audience: null
  exclusions: []

creative:
  governing_pattern: "urgency_and_value_bundle"
  offer_guidance: "Use a time-bound bundle supported by the current offer."
  primary_text_guidance: "Lead with the verified value and deadline."
  headline_guidance: "State the bundle and verified end date."
  required_variants:
    - "value"
    - "urgency"
    - "product_appeal"
  prohibited_claims: []

measurement:
  primary_metric: "cost_per_purchase"
  secondary_metrics: ["roas", "cvr", "ctr"]
  tracking_requirements:
    - "purchase_event_verified"
    - "utm_parameters"
```

## 5. Provenance schema

Provenance keys use output field paths.

```yaml
provenance:
  campaign.objective:
    source: "user_brief"
    transformation: "none"
  campaign.optimization_goal:
    source: "objective_rule"
    transformation: "objective_to_event_mapping"
  campaign.daily_budget:
    source: "blend"
    campaign_ids: ["camp_8842", "camp_9107"]
    evidence: {closest_daily_spend: 90, cohort_p75_daily_spend: 65}
    transformation: "min(0.5x_closest, cohort_p75, policy_limit)"
  audience.geo:
    source: "user_brief"
    transformation: "provider_geo_resolution"
  audience.pattern:
    source: "closest_best"
    campaign_ids: ["camp_8842"]
    transformation: "pattern_generalized"
  creative.governing_pattern:
    source: "overall_best"
    campaign_ids: ["camp_9107"]
    transformation: "pattern_generalized"
```

## 6. Evidence-summary schema

Every material rationale statement is decomposed into structured evidence:

```yaml
evidence_summary:
  - claim: "The closest reference is a strong local LTO pattern."
    campaign_id: "camp_8842"
    metric: "roas"
    value: 4.6
    comparison: "cohort_median"
    comparison_value: 3.1
  - claim: "The overall reference provides the highest-scoring creative pattern."
    campaign_id: "camp_9107"
    metric: "composite_score"
    value: 0.86
```

The readable rationale is generated only from these evidence objects.

## 7. Confidence schema

```yaml
confidence:
  score: 0.83
  level: "high" # low | medium | high
  components:
    match_specificity: 0.95
    significance_quality: 0.88
    jtd_confidence: 0.91
    reference_recency: 0.82
    tracking_quality: 0.90
    reference_diversity: 0.70
  limitations:
    - "Historical performance does not prove the new offer will perform identically."
```

## 8. Review schema

```yaml
review:
  required: true
  reasons:
    - "V1 requires human review"
  checklist:
    - id: "offer_current"
      label: "Offer and deadline are current and supported by the destination page"
      confirmed: false
    - id: "tracking_ready"
      label: "Purchase event and UTMs are ready"
      confirmed: false
    - id: "budget_approved"
      label: "Daily budget is approved"
      confirmed: false
```

## 9. Rejection rules

Reject playbook generation when:

- The selected account is unavailable.
- The brief lacks objective, JTD, region, or product.
- Money uses mixed currencies.
- Reference metrics cannot be traced to an audit record.
- An LLM introduces an unrecognized campaign ID or metric value.
- The output fails the strict schema.

Retry the LLM once for formatting/grounding failure. On repeated failure, return a typed error and preserve the deterministic evidence package.

