# Campaign Intelligence V1

## 1. Purpose

Campaign Intelligence V1 turns a connected Meta ad account's historical performance into an evidence-grounded playbook for a new campaign.

It does not ask an LLM to guess which campaigns worked. A deterministic audit calculates comparable performance scores and assigns tiers. The LLM provides bounded interpretation: Job To Be Done classification, supported nuance, synthesis, and readable rationale tied to campaign IDs and metric values.

## 2. Product promise

> Select a Meta ad account, audit its historical campaigns, choose the job for a new campaign, and receive a glass-box campaign playbook based on the closest relevant winner and the strongest overall pattern.

V1 produces a reviewable recommendation. It does not automatically publish or activate a real campaign.

## 3. Runtime data decision

The connected, explicitly selected Meta ad account is the only runtime source for account, campaign, recommendation, error, and performance evidence. Seed fixtures remain test-only and must never appear in the product UI when a live account is connected.

```text
Selected Meta account
  -> live reporting normalization
  -> deterministic significance gates and scoring
  -> live winner/underperformer evidence
  -> grounded campaign playbook
```

If the live provider does not return a required metric, the UI must say `Not enough data`; it must not substitute a fixture or invented value.

## 4. Why this is different from the original prototype

The current prototype is a cold-start planner. It creates a campaign from the user's brief and fixed planning rules.

Campaign Intelligence adds an account-specific evidence layer:

```text
Current prototype
Brief + fixed rules → campaign proposal

Campaign Intelligence V1
Selected account → historical audit → winner library
                                      + new brief/JTD
                                      → grounded campaign playbook
```

The cold-start planner remains useful when an account lacks sufficient comparable data.

## 5. Primary user

- Growth marketer, media buyer, founder, or account manager.
- Has access to at least one Meta ad account.
- Wants to understand what has worked before launching a new campaign.
- Needs recommendations that can be traced to historical evidence.
- May hand the resulting JSON/YAML to a team or later execution service.

## 6. End-to-end workflow

### Step 1 — Select account

The user connects Meta and explicitly selects one ad account.

Display:

- Account name and ID.
- Currency and timezone.
- Available date range.
- Number of campaigns.
- Tracking assets found.
- Data-readiness warnings.

No cross-account data is used unless the product later introduces an explicitly approved benchmark pool.

One Meta OAuth connection can expose every ad account the authenticated person is permitted to read. This does **not** mean that AdPilot silently blends those accounts. The user chooses one source account for each audit so that spend, currency, market context, and recommendations remain attributable. A multi-account portfolio is a later, separately scoped feature.

### Step 2 — Configure audit

V1 defaults:

- Grain: campaign.
- Rollup window: the last 60 days.
- Include active and completed campaigns.
- Exclude drafts and campaigns with no delivery.
- Respect the account's attribution outputs as returned by Meta.

The user can review, but initially does not need to tune, significance and scoring parameters.

### Step 3 — Normalize historical data

For every campaign, produce one normalized record containing identity, context, configuration, delivery, outcomes, and data-quality fields.

Derived metrics are calculated in deterministic code. The LLM never calculates authoritative metrics from raw rows.

The audit also produces display dimensions for discovery:

- **Region** — provider-returned geography when available; otherwise a naming-convention inference labelled `Inferred from campaign name`.
- **Product / offer** — provider-returned promoted-product or destination metadata when available; otherwise a labelled naming-convention inference.
- **Creative format** — provider-returned ad creative metadata when available. Campaign-level reporting alone cannot prove a creative format; if ad-level metadata is unavailable, the result is `Not enough data`, never a guessed format presented as fact.

These dimensions are filters and winner-explorer groupings, not part of the first scoring cohort. A small regional or product group must not be used to manufacture a statistically meaningful rank.

### Step 4 — Assign historical JTD

Each historical campaign receives one primary Job To Be Done.

Inputs may include:

- Campaign, ad-set, and ad names.
- Objective and optimization goal.
- Offer and creative text.
- Destination and promoted product metadata.
- Audience type.
- Conversion event.

The LLM returns a taxonomy ID, confidence, evidence fields, and a short rationale. Low-confidence assignments require human review or enter an `unknown` cohort.

### Step 5 — Apply significance gates

Before scoring, each campaign is tested against objective-specific minimum evidence requirements.

Campaigns that fail are labeled `insufficient_data`. They remain visible but do not influence normalization, cohort medians, winner selection, or loser selection.

### Step 6 — Score comparable campaigns

Campaigns are compared inside like-for-like cohorts, initially:

```text
objective + JTD
```

The deterministic engine:

1. Winsorizes extreme metric values.
2. Normalizes eligible metrics within the cohort.
3. Applies objective-specific weights.
4. Calculates a composite score from 0 to 1.
5. Applies objective-specific guardrails.
6. Assigns a tier and action.

### Step 7 — Explain the audit

The LLM receives only normalized campaign results and cohort evidence.

It may:

- Explain why a campaign received its deterministic tier.
- Add evidence-supported nuance flags.
- Point out tracking or comparison limitations.

It may not alter the score or tier.

### Step 8 — Define the new job

The user creates a new brief containing:

- Region.
- Product or offer.
- Objective.
- Job To Be Done.
- Optional budget.
- Destination.
- Offer constraints.
- Creative constraints.

The JTD can be selected directly or suggested by the LLM and confirmed by the user.

### Step 9 — Retrieve historical references

Retrieve two references:

- **Closest best:** highest-quality winner at the most specific available region/product/JTD match.
- **Overall best:** strongest proven winner for the same objective/JTD across regions and products.

The system records the exact fallback rung used. The two references may be the same campaign; this is shown explicitly rather than hidden.

### Step 10 — Synthesize a playbook

Create a new campaign recommendation using field-level rules:

- User brief supplies non-negotiable business intent.
- Closest best supplies local and product relevance.
- Overall best supplies repeatable structure and creative pattern.
- Deterministic rules calculate bounded budget and enforce policy.
- LLM translates supported patterns into new guidance without copying unsupported claims.

Every output field records its provenance.

### Step 11 — Review and export

The user reviews:

- Audit summary.
- Reference campaigns and metrics.
- Match quality.
- Proposed campaign configuration.
- Field provenance.
- Rationale, confidence, assumptions, and warnings.

V1 can export strict JSON and YAML. Real execution remains a separate future step.

## 7. Glass-box principles

1. Numbers and deterministic rules decide tiers.
2. LLM output cannot change authoritative metrics.
3. Every performance claim cites a campaign ID and metric value.
4. Every recommendation field identifies its source.
5. Missing evidence lowers confidence and increases review requirements.
6. Historical correlation is described as evidence, not causal proof.
7. No campaign is called a winner or loser below its significance gate.
8. Configuration versions are stored with every audit and recommendation.

## 8. V1 product surfaces

### Account selection

Select the source ad account and inspect data availability.

The live Meta V1 enters this surface from Connections through a single `Run 60-day audit` action. Account selection is searchable and compact; a long connected-account list must not dominate the page.

### Account audit

- Cohort overview.
- Winner/contender/underperformer/kill/insufficient-data counts.
- Campaign table with metrics and reasons.
- Filters for objective, JTD, region, product, and tier.
- Data-quality warnings.

The default audit page answers four clear questions in this order:

1. Where did the account spend money?
2. Which campaigns are proven winners against their own objective?
3. Which regions, products/offers, and creative formats have enough evidence to investigate?
4. What should the next campaign brief reuse, test, or avoid?

The page provides a Top campaigns table sorted by evidence quality and separate region, product, and format groupings. A grouping with insufficient data remains visible but is not framed as a winner.

The account audit and Intelligence surfaces both read the currently selected live account. They display the account name, ID, reporting window, and retrieval timestamp. Test fixtures are allowed only in automated tests.

### Campaign evidence detail

- Raw and derived metrics.
- Significance-gate results.
- Cohort medians/percentiles.
- Metric contributions to composite score.
- Tier rule passed.
- JTD evidence and confidence.
- Nuance flags.

### New playbook

- Explicit brief and JTD selector before a playbook is generated. No fabricated default region, product, offer, or objective.
- Closest-best match ladder.
- Overall-best reference.
- Side-by-side comparison.
- Synthesized config and provenance.
- Confidence and review requirements.
- JSON/YAML export.

The primary surface is a guided account-audit-to-playbook flow. An LLM agent may be exposed through the API or a secondary analysis surface, but raw tool traces and a free-form agent prompt cannot dominate the V1 journey.

## 9. V1 scope

Included:

- One selected Meta ad account.
- Campaign-grain 30-day audits.
- Sales, leads, traffic, and awareness cohorts.
- Historical JTD tagging.
- Objective-specific deterministic scoring.
- Five performance tiers.
- Closest-best and overall-best retrieval.
- Field-level synthesis and provenance.
- Real read-only data from the selected Meta account.
- Test-only fixtures that are never rendered in the connected runtime.
- JSON/YAML recommendation output.
- Human review.

Excluded:

- Automatic campaign publishing.
- Automatic activation, pause, or budget changes.
- Cross-account benchmarking.
- Causal incrementality claims.
- Real-time bidding decisions.
- Full creative asset generation.
- Ad-set/ad-level scoring in the first pass.
- Automatic JTD taxonomy creation.

## 10. V1 success criteria

The V1 is successful when a reviewer can:

- Select an account and understand whether its data is usable.
- Trace every tier to metrics, cohort statistics, and a rule.
- Correct a low-confidence JTD assignment.
- See why closest best and overall best were selected.
- Identify the source of every important recommended field.
- Export a schema-valid playbook.
- Receive an honest cold-start result when no reliable winner exists.
