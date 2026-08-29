# Campaign Intelligence V1 — Open Decisions

These decisions should be reviewed before implementation. Recommended defaults are listed first.

## D1 — Historical grain

**Recommendation:** Start at campaign grain for audit clarity, while preserving ad-set/ad identifiers for future drill-down.

Risk: campaign-level results may hide which audience or creative actually drove performance.

## D2 — Audit window

**Recommendation:** Previous 30 complete days, with explicit start/end dates and account timezone.

Alternative: last 30 rolling days or per-campaign lifetime.

## D3 — JTD ownership

**Recommendation:** LLM suggests historical JTD; the user confirms low-confidence cases. The user confirms the new brief's JTD.

## D4 — Initial taxonomy

**Recommendation:** Use the nine IDs in `JTD_AND_RETRIEVAL_V1.md`, including `unknown`, and version additions.

Question: should restaurant-specific jobs such as `promote_delivery`, `daypart_demand`, or `franchise_local_push` be added immediately?

## D5 — Cohort size

**Recommendation:** Require five significant campaigns for normalized relative scoring.

Alternative: three campaigns with a stronger confidence penalty.

## D6 — Significance thresholds

**Recommendation:** Use objective-specific defaults from `AUDIT_SCORING_V1.md`, stored as tunable account configuration.

Question: should thresholds be absolute or adapt to account spending volume?

## D7 — Normalization

**Recommendation:** P05/P95 winsorization followed by min-max normalization for V1 because it is easy to explain.

Future alternative: robust z-score or percentile rank.

## D8 — Winner threshold

**Recommendation:** Composite score at least 0.75 plus an objective-specific median guardrail.

## D9 — Kill terminology

**Recommendation:** Display `Kill candidate` rather than `Kill` because V1 recommends review and does not automatically pause.

## D10 — Leads quality

**Recommendation:** Use qualified-lead metrics only when the connected CRM provides complete data for the cohort; otherwise use Meta lead counts consistently.

## D11 — Revenue source

**Recommendation:** Use Meta-attributed conversion value in initial simulation, clearly labeled. Add first-party order/CRM revenue later.

## D12 — Reference eligibility age

**Recommendation:** Prefer recent winners and make campaigns older than 90 days ineligible by default unless explicitly included.

## D13 — Closest-best ladder

**Recommendation:** Never relax objective. Relax region/product specificity in the order documented in `JTD_AND_RETRIEVAL_V1.md`.

## D14 — Duplicate reference

**Recommendation:** Allow the same campaign to fill closest and overall roles, disclose it, and reduce only reference-diversity confidence.

## D15 — No-winner fallback

**Recommendation:** Use the existing deterministic cold-start planner. Never silently promote a contender to winner.

## D16 — Budget formula

**Recommendation:** Start from half of closest-best effective daily spend, capped by cohort p75 and workspace policy. Preserve a valid user-supplied budget and show comparisons rather than silently changing it.

Question: should minimum viable spend be objective/account-specific?

## D17 — LLM provider

**Recommendation:** Keep the contract provider-neutral. Choose one structured-output model for the first implementation after evaluating grounding reliability.

## D18 — LLM responsibilities

**Recommendation:** Historical JTD tagging, nuance annotation, recommendation synthesis, and rationale only. No authoritative arithmetic, tier assignment, budget authorization, or execution.

## D19 — Output format

**Recommendation:** Canonical JSON with schema validation; YAML generated from the validated JSON for humans and execution teams.

## D20 — Real Meta data

**Recommendation:** Implement simulation fixtures first, then connect the existing read-only Meta integration. Keep real execution out of Campaign Intelligence V1.

## Suggested approval format

Approve all recommendations:

> Campaign Intelligence V1 approved as proposed.

Or specify changes:

> D4: add daypart demand. D5: require three campaigns. D16: preserve only user-approved budgets.

