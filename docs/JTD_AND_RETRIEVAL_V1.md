# JTD, Retrieval, and Synthesis V1

## 1. Job To Be Done model

A JTD describes why a campaign exists, not merely its Meta objective.

For example, two sales campaigns may perform different jobs: acquiring a new customer and reactivating a lapsed customer. They should not automatically be treated as interchangeable patterns.

## 2. V1 taxonomy

| ID | Meaning | Typical evidence |
| --- | --- | --- |
| `acquire_new` | Acquire first-time customers | Prospecting audiences, new-customer messaging |
| `first_order` | Convert consideration into a first purchase | Trial offer, first-order discount |
| `reactivate_lapsed` | Bring dormant customers back | Lapsed-customer custom audience, comeback message |
| `promote_lto` | Drive a limited-time or seasonal offer | Deadline, seasonal product, temporary bundle |
| `drive_catering` | Generate large/group/catering orders | Catering page, lead form, group-order messaging |
| `lift_aov` | Increase basket size | Bundle, add-on, threshold, upsell |
| `new_location_awareness` | Introduce a new location | Reach objective, local radius, opening message |
| `loyalty_signup` | Grow app/rewards membership | App install, loyalty enrollment, member benefit |
| `unknown` | Evidence is insufficient or conflicting | Low-confidence classification |

V1 assigns one primary JTD. Secondary JTDs are deferred to avoid ambiguous cohorts.

## 3. Historical JTD classification

### Deterministic hints

Before the LLM call, extract hints from:

- Naming patterns.
- Objective and conversion event.
- Destination URL path.
- Audience type.
- Offer and promotion language.
- Campaign timing.

### LLM input

The LLM receives only the normalized campaign context needed for classification. Performance metrics may provide context but must not influence the semantic meaning of the job.

### LLM output

```json
{
  "campaign_id": "camp_123",
  "jtd": "promote_lto",
  "confidence": 0.91,
  "evidence": [
    { "field": "campaign_name", "value": "Summer bundle ends Sunday" },
    { "field": "destination_url", "value": "/summer-bundle" }
  ],
  "rationale": "The temporary bundle and explicit deadline indicate an LTO campaign."
}
```

### Review rules

- Confidence at least 0.80: accept provisionally.
- Confidence 0.60–0.79: show for user confirmation.
- Confidence below 0.60: assign `unknown` until reviewed.
- A user correction is stored separately from the model suggestion.

## 4. New-brief JTD

The new-campaign form asks:

> What job should this campaign accomplish?

The user can:

- Choose a taxonomy item.
- Describe the goal and request a suggestion.
- Confirm or change the suggestion.

The confirmed JTD is authoritative for retrieval.

## 5. Eligible reference pool

A campaign can serve as a reference only if:

- Tier is `winner`.
- It passed significance gates.
- JTD is not `unknown`.
- JTD confidence is at least 0.80 or was user-confirmed.
- It has no critical tracking gap.
- Its objective is compatible with the new brief.
- Its configuration is still representable by the current provider adapter.

## 6. Closest-best ladder

Search the eligible pool in order and stop at the first rung containing at least one candidate:

1. Region + product + JTD + objective.
2. Region + product + objective.
3. Product + JTD + objective.
4. Region + JTD + objective.
5. JTD + objective.
6. Objective.

Within the matched rung, rank by:

1. Composite score.
2. Evidence recency.
3. Conversion/outcome volume.
4. Lower data-quality risk.

Return one campaign and persist:

- Candidate count.
- Matched rung.
- Ranking features.
- Rejected candidates and reason codes.

The objective is never relaxed because it changes measurement and platform optimization behavior.

## 7. Overall-best selection

Filter by:

```text
JTD + objective
```

Rank using the same quality and recency tie-breakers. Ignore region and product.

If closest best and overall best resolve to the same campaign:

- Return that campaign in both roles.
- Set `references_are_same = true`.
- Do not pretend two independent patterns were found.
- Lower diversity confidence but not evidence confidence.

## 8. Cold-start behavior

### No closest match, overall winner exists

- Use overall best only.
- Use user brief for region, product, and offer.
- Mark local relevance as unproven.
- Require review.

### No eligible winner exists

- Do not label a contender as a winner.
- Return a cold-start proposal from the existing deterministic campaign planner.
- Set `recommendation_mode = cold_start`.
- Explain which evidence was missing.
- Require review.

### Small or unreliable cohort

- Exclude unreliable tier results from the winner pool.
- Return cold-start or broader objective evidence according to configuration.
- Cap confidence.

## 9. Field-level synthesis

Source precedence matters. User intent cannot be overwritten by historical patterns.

| Output field | Primary source | Fallback |
| --- | --- | --- |
| Region/geography | User brief | None |
| Product | User brief | None |
| JTD | User-confirmed brief | None |
| Objective | User brief | Recommended change shown separately |
| Offer | User brief | Closest-best pattern as guidance only |
| Audience pattern | Closest best | Deterministic broad audience |
| Creative angle | Overall best | Closest best, then cold-start rules |
| Optimization goal | Objective rule | Overall best if compatible |
| Bid strategy | Objective/provider rule | Overall best if compatible |
| Placements | Provider rule | Overall best if still valid |
| Budget | Deterministic bounded formula | User budget or policy default |
| Copy guidance | LLM synthesis | Deterministic templates |

Historical offer details are never copied as facts into a different product. They are treated as patterns such as `bundle`, `urgency`, or `trial incentive`.

## 10. Budget recommendation

V1 proposed rule:

```text
historical_start = 0.5 × closest_best effective daily spend
historical_cap   = eligible cohort p75 effective daily spend
recommended      = min(historical_start, historical_cap, workspace_daily_limit)
```

If the user supplies a budget:

- Preserve it when within policy.
- Compare it with the evidence-based range.
- Warn when materially below or above that range.
- Never silently replace it.

If closest best is unavailable, use overall best. If both are unavailable, use the current cold-start budget-tier rules.

## 11. Provenance model

Each important field uses:

```json
{
  "value": "urgency_and_value",
  "source": "overall_best",
  "campaign_id": "camp_9107",
  "evidence": {
    "composite_score": 0.86,
    "roas": 5.1
  },
  "transformation": "pattern_generalized"
}
```

Allowed sources:

- `user_brief`
- `closest_best`
- `overall_best`
- `blend`
- `objective_rule`
- `provider_rule`
- `workspace_policy`
- `cold_start_rule`
- `llm_synthesis`

## 12. Recommendation confidence

Confidence combines:

- Reference significance quality.
- JTD confidence.
- Match-rung specificity.
- Cohort size.
- Reference recency.
- Tracking quality.
- Whether two distinct references exist.

The LLM does not invent the confidence score. Deterministic code calculates it; the LLM explains it.

Human review is always required in V1 and prominently emphasized when:

- Confidence is below 0.70.
- Budget exceeds 100 account-currency units per day.
- Closest-best matching reaches the objective-only rung.
- A cold-start proposal is used.
- Tracking or attribution warnings exist.

