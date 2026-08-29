# Historical Audit and Scoring V1

## 1. Goal

Classify historical campaigns consistently and transparently without asking an LLM to perform authoritative arithmetic or winner selection.

## 2. Audit input record

One record per campaign per audit window.

### Identity

- `account_id`
- `campaign_id`
- `campaign_name`
- `campaign_status`
- `date_start`
- `date_stop`
- `days_active`

### Context

- `region`
- `product`
- `objective`
- `optimization_goal`
- `conversion_event`
- `jtd`
- `jtd_confidence`

### Delivery

- `spend`
- `currency`
- `budget_type`
- `configured_budget`
- `impressions`
- `reach`
- `clicks`
- `landing_page_views`
- `frequency`

### Outcomes

- `conversions`
- `conversion_value`
- `revenue`
- `leads`
- `qualified_leads` when available

### Data quality

- `tracking_status`
- `attribution_setting`
- `missing_fields[]`
- `warnings[]`

## 3. Derived metrics

All divisions use safe zero/null handling. An undefined metric stays `null`; it is never silently converted to a favorable zero.

```text
CTR  = clicks / impressions
LPV rate = landing_page_views / clicks
CVR  = conversions / landing_page_views (preferred)
       or conversions / clicks when LPV is unavailable
CPA  = spend / conversions
CPL  = spend / leads
CPQL = spend / qualified_leads
ROAS = revenue / spend
AOV  = revenue / conversions
Frequency = impressions / reach
```

Every metric records the denominator definition used.

## 4. Significance gates

V1 uses objective-specific gates rather than a universal conversion rule.

### Sales

- Minimum spend: 100 account-currency units.
- Minimum impressions: 10,000.
- Minimum purchases: 15.
- Minimum active days: 5.

### Leads

- Minimum spend: 100.
- Minimum impressions: 5,000.
- Minimum leads: 15.
- Minimum active days: 5.

### Traffic

- Minimum spend: 50.
- Minimum impressions: 5,000.
- Minimum landing-page views: 100.
- Minimum active days: 3.

### Awareness

- Minimum spend: 50.
- Minimum reach: 10,000.
- Minimum active days: 3.

These defaults are configuration, not universal truths. The audit stores the applied configuration version.

If any required gate fails:

```text
tier = insufficient_data
score = null
eligible_for_reference = false
```

## 5. Cohorts

Default cohort key:

```text
account_id + objective + jtd
```

Region is a filter and retrieval feature, not initially a scoring cohort key. Including region too early may produce cohorts too small for reliable normalization.

Minimum cohort size for normalized scoring: five significant campaigns.

If the cohort has fewer than five:

- Use absolute objective guardrails where available.
- Mark `small_cohort`.
- Cap classification confidence.
- Do not assign `kill` purely from relative rank.

## 6. Outlier handling and normalization

Before normalization, clamp eligible raw metric values to cohort percentile bounds:

```text
lower bound = p05
upper bound = p95
```

V1 normalization:

```text
normalized = (clamped_value - cohort_min) / (cohort_max - cohort_min)
```

For a lower-is-better metric:

```text
normalized_score = 1 - normalized
```

If all cohort values are equal, the metric contribution is `0.5`, not zero or one.

The audit persists raw value, clamped value, normalized value, direction, weight, and weighted contribution.

## 7. Objective-specific weights

### Sales

| Metric | Weight | Direction |
| --- | ---: | --- |
| ROAS | 0.35 | Higher |
| CPA | 0.25 | Lower |
| CVR | 0.15 | Higher |
| Purchases | 0.15 | Higher |
| CTR | 0.10 | Higher |

### Leads

| Metric | Weight | Direction |
| --- | ---: | --- |
| CPL or CPQL | 0.45 | Lower |
| Leads or qualified leads | 0.30 | Higher |
| CVR | 0.15 | Higher |
| CTR | 0.10 | Higher |

Use CPQL when qualified-lead data is complete across the cohort; otherwise use CPL consistently for all cohort members.

### Traffic

| Metric | Weight | Direction |
| --- | ---: | --- |
| Cost per landing-page view | 0.40 | Lower |
| Landing-page views | 0.25 | Higher |
| LPV rate | 0.20 | Higher |
| Outbound CTR | 0.15 | Higher |

### Awareness

| Metric | Weight | Direction |
| --- | ---: | --- |
| Cost per 1,000 people reached | 0.35 | Lower |
| Reach | 0.30 | Higher |
| Frequency health | 0.20 | Target band |
| ThruPlay/video completion rate when applicable | 0.15 | Higher |

Awareness requires a separate frequency-health function rather than treating unlimited frequency as positive.

## 8. Composite score

```text
composite_score = sum(metric_weight * normalized_metric_score)
```

Weights are renormalized only when a metric is unavailable for the entire cohort. A metric missing for one campaign produces a data-quality failure rather than quietly changing that campaign's weights.

## 9. Classification

Tiers are evaluated top to bottom.

### Winner

- Composite score at least 0.75.
- Passes objective-specific outcome guardrail.
- No critical tracking gap.

Objective guardrails:

- Sales: ROAS at least 1.2 times cohort median ROAS.
- Leads: CPL at most 0.8 times cohort median CPL.
- Traffic: cost per LPV at most 0.8 times cohort median.
- Awareness: cost per 1,000 people reached at most 0.8 times cohort median and frequency within configured range.

Default action: use as a reference and consider controlled scaling.

### Contender

- Composite score at least 0.55.

Default action: iterate and gather more evidence.

### Underperformer

- Composite score at least 0.30.

Default action: diagnose, fix, or watch.

### Kill candidate

- Composite score below 0.30, or
- Objective cost metric is worse than twice the cohort median.

Default action: recommend review for pause. V1 does not automatically pause.

Small cohorts cannot produce a kill candidate from relative score alone.

## 10. Nuance flags

LLM-suggested flags must cite supporting values:

- `creative_fatigue`
- `seasonal`
- `audience_saturation`
- `learning_limited`
- `tracking_gap`
- `small_cohort`
- `promotion_distortion`
- `attribution_mismatch`

Flags annotate results. They do not change deterministic tier assignments in V1.

## 11. Score explanation

Campaign detail must show:

- Gate pass/fail results.
- Cohort identity and size.
- Cohort comparison window.
- Metric table with raw and normalized values.
- Weighted contribution from each metric.
- Composite score.
- Tier rule that matched.
- Confidence and limitations.

## 12. Versioning

Create a new scoring configuration version when changing:

- Significance thresholds.
- Cohort keys.
- Metric definitions.
- Metric weights.
- Normalization or winsorization.
- Tier thresholds or guardrails.

Historical results remain attached to the version that generated them.

