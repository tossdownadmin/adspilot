# Campaign Intelligence Simulation V1

## 1. Simulation objective

Demonstrate the complete intelligence workflow before depending on real Meta data quality or enabling any external mutation.

The simulator should answer:

- Can the audit distinguish evidence from insufficient data?
- Can a user understand why something is a winner?
- Does JTD materially improve comparisons?
- Can retrieval explain closest best versus overall best?
- Is field-level provenance useful during review?
- Does the system fail honestly when evidence is weak?

## 2. Simulation mode

Add a second selectable connection beside the existing launch simulator:

```text
Campaign Intelligence Demo Account
```

It contains a fixed, versioned historical dataset. Resetting the simulation restores the original data and audit outputs.

## 3. Seed account

Proposed account:

- Business: Northstar Pizza Group.
- Currency: USD.
- Regions: MD-DC, VA-Richmond, and PA-Philadelphia.
- Products: pizza, catering, and loyalty.
- Audit window: 30 days.
- Campaign count: 18–24.
- Objectives: sales, leads, traffic, awareness.
- JTD coverage: promote LTO, acquire new, reactivate lapsed, drive catering, loyalty signup, and new-location awareness.

The dataset must include realistic variation and deliberately difficult cases.

## 4. Required historical cases

### Proven local winner

- Same region, product, objective, and JTD as the primary demo brief.
- Strong significant performance.
- Becomes closest best.

### Strong overall pattern

- Same objective and JTD in another region/product.
- Higher overall score and reusable creative pattern.
- Becomes overall best.

### Contender

- Credible performance without clearing winner guardrails.

### Underperformer

- Moderate score with a diagnosable weakness.

### Kill candidate

- Significant spend and volume but poor objective cost efficiency.

### Insufficient data

- Attractive early ROAS from only two purchases.
- Must never appear in the winner pool.

### Creative fatigue

- Strong outcome efficiency with elevated/rising frequency and declining recent CTR.
- Tier remains numeric; fatigue is a nuance flag.

### Tracking gap

- Metrics conflict or conversion tracking changed during the window.
- Excluded from reference eligibility.

### Small cohort

- Valid campaign in a JTD/objective cohort with fewer than five significant peers.
- Confidence is capped.

### Same closest and overall

- A brief for which one campaign fills both roles.
- UI must state that evidence is concentrated in one reference.

### No winner

- A brief with no eligible winner.
- Returns cold-start mode rather than promoting a contender.

## 5. Primary walkthrough

### Screen 1 — Account selection

User selects `Northstar Pizza Group — Demo`.

Show:

- 22 campaigns found.
- 30-day window.
- USD and account timezone.
- 19 campaigns with complete delivery data.
- Three campaigns with tracking/data warnings.

### Screen 2 — Audit progress

Stages:

1. Normalizing Meta metrics.
2. Assigning JTDs.
3. Applying evidence gates.
4. Building cohorts.
5. Calculating scores.
6. Generating grounded explanations.

### Screen 3 — Audit summary

Illustrative result:

```text
Winner               4
Contender             5
Underperformer        4
Kill candidate        3
Insufficient data     6
```

The exact seed results must be asserted in automated fixtures.

### Screen 4 — Winner detail

Open `camp_8842 — DC Summer Bundle`.

Show:

- JTD: `promote_lto`, confidence 0.91.
- Cohort: sales + promote LTO, 6 eligible campaigns.
- Significance gates passed.
- ROAS 4.6 versus cohort median 3.1.
- CPA 4.5 versus cohort median.
- Weighted score contributions.
- Composite score 0.81.
- Winner guardrail passed.
- Creative-fatigue annotation supported by frequency and trend evidence.

### Screen 5 — New brief

```yaml
region: MD-DC
product: pizza
objective: sales
jtd: promote_lto
requested_daily_budget: 50
offer: current weekend bundle
```

### Screen 6 — Retrieval explanation

Closest best:

- `camp_8842`.
- Exact region + product + JTD + objective.
- Composite score 0.81.

Overall best:

- `camp_9107`.
- Same JTD + objective, another region.
- Composite score 0.86.

Show which candidates were considered and why the two references won.

### Screen 7 — Playbook

Display:

- User intent.
- Configuration.
- Closest-best contribution.
- Overall-best contribution.
- Budget calculation.
- Provenance chips on individual fields.
- Evidence-backed rationale.
- Confidence breakdown.
- Human-review checklist.
- JSON/YAML toggle and copy/download action.

## 6. Failure walkthroughs

### Insufficient-data trap

A campaign shows ROAS 8.0 but only two purchases. It must be labeled `insufficient_data`, excluded from cohort normalization, and absent from both reference slots.

### Lead campaign

A lead-generation winner is selected using CPL/lead volume/CVR/CTR. It must not be required to have revenue or ROAS.

### No local match

The closest-best ladder falls back to product + JTD + objective. The UI shows the exact rung and warns that local relevance is not proven.

### No winner anywhere

The system returns:

```text
recommendation_mode = cold_start
confidence = low
review_required = true
```

It explains that no historical campaign passed the winner criteria.

### Ungrounded LLM output

The simulated LLM cites an unknown campaign ID or metric. The grounding validator rejects it. The user sees a safe generation error, while the deterministic audit remains available.

## 7. Interactive controls

The simulator may allow reviewers to change:

- New brief region, product, objective, and JTD.
- Audit window.
- Minimum evidence gates.
- Metric weights.
- Winner threshold.

Changing configuration creates a new preview version. The UI shows which classifications changed and never overwrites the prior audit silently.

## 8. Review questions

During stakeholder review, ask:

1. Are winner explanations understandable without knowing the formula?
2. Are the JTD labels commercially meaningful?
3. Is closest-best matching more useful than simply choosing the top campaign?
4. Does provenance improve trust or create too much detail?
5. Should campaign, ad set, or ad be the primary grain?
6. Which metrics actually represent business quality for leads?
7. Is the output suitable for copy/paste by the execution team?
8. What decisions must remain human-only?

## 9. Simulation acceptance criteria

- Seed audit produces deterministic expected tiers.
- Objective-specific gates work.
- No insufficient-data campaign becomes a reference.
- JTD correction rebuilds affected cohorts.
- Closest-best fallback rung is visible.
- Same-reference and no-winner cases are honest.
- Every material recommendation field has provenance.
- Every rationale claim resolves to stored evidence.
- JSON and YAML outputs validate against the same schema.
- No real Meta mutation is possible in simulation mode.

