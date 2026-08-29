# Campaign-Building Logic

> This document defines the cold-start campaign planner. When a connected account has sufficient historical evidence, Campaign Intelligence V1 takes precedence using `CAMPAIGN_INTELLIGENCE_V1.md`, `AUDIT_SCORING_V1.md`, and `JTD_AND_RETRIEVAL_V1.md`. When no eligible historical winner exists, this cold-start planner remains the explicit fallback.

## 1. Purpose and authority

This document defines how AdPilot turns a business brief into a campaign proposal. It is the product source of truth for campaign-planning behavior.

The implementation must mirror these rules in typed code and automated tests. Editing this document alone does not change application behavior. A rule change is complete only when the specification, engine, tests, and relevant UI explanation agree.

## 2. Responsibility boundary

Campaign construction uses three different decision layers:

1. **Deterministic application rules** enforce supported values, spending limits, permissions, state transitions, and safety requirements.
2. **Planning intelligence** selects a strategy, describes an audience hypothesis, creates messaging variants, and explains assumptions. The prototype uses deterministic planning; a future version may use an LLM.
3. **Advertising-platform delivery systems** choose impressions and optimize delivery inside the limits of the approved campaign.

An LLM may propose a decision, but it cannot override application policy, approve spending, produce an authorization token, or activate a campaign.

## 3. Required campaign brief

A plan cannot be generated without:

- Business name.
- Product or offer name.
- Offer description of at least 20 characters.
- Supported objective.
- Valid destination URL.
- Target geography.
- ISO currency.
- Positive daily budget.
- Duration between 1 and 90 days.

Audience hypothesis, brand voice, and extra instructions are optional. Missing optional inputs must become visible assumptions rather than hidden inventions.

## 4. Supported objectives

### 4.1 Sales

Use when the desired business outcome is an online purchase.

- Platform objective: sales/conversions.
- Optimization goal: purchase conversions.
- Primary metric: cost per purchase.
- Secondary metrics: click-through rate, landing-page conversion rate, and return on ad spend.
- Default call to action: `Shop now`.
- Required tracking: pixel/dataset, verified purchase event, and UTM parameters.

### 4.2 Leads

Use when the desired outcome is a qualified inquiry, application, booking request, or contact submission.

- Platform objective: leads.
- Optimization goal: qualified leads.
- Primary metric: cost per lead.
- Secondary metrics: form completion rate, qualified-lead rate, and lead-to-sale rate.
- Default call to action: `Get quote`.
- Required tracking: lead event, form/CRM handoff, and UTM parameters.

The system must not claim a lead is qualified unless downstream qualification data exists.

### 4.3 Traffic

Use for landing-page discovery when a reliable downstream conversion event is not available.

- Platform objective: traffic.
- Optimization goal: landing-page views.
- Primary metric: cost per landing-page view.
- Secondary metrics: outbound click-through rate, engaged-session rate, and downstream conversion rate.
- Default call to action: `Learn more`.
- Required tracking: page-view event, analytics session tracking, and UTM parameters.

Traffic should not be selected merely because it produces cheaper clicks when the actual goal is sales or leads.

## 5. Budget tiers

The daily budget controls experiment complexity. It does not change the workspace spending ceiling.

| Tier | Daily budget | Structure | Creative variants | Intent |
| --- | ---: | --- | ---: | --- |
| Lean | Under 50 account-currency units | One prospecting ad set | 2 | Avoid fragmenting limited data |
| Validation | 50–149 | One prospecting ad set | 3 | Test three distinct message angles |
| Scale-ready | 150 or more | One prospecting ad set in prototype | 4 | Add a proof-focused challenger |

The scale-ready prototype still uses one ad set. Retargeting and multiple-audience allocation require reliable event volume and are deferred until reporting is implemented.

The engine must never increase the user's supplied budget. A budget above workspace policy is a blocker, not an invitation for the agent to rewrite the budget silently.

## 6. Campaign structure

The prototype uses the following normalized hierarchy:

```text
One campaign
  -> One broad prospecting ad set
       -> Two to four ads, based on budget tier
```

Reasons:

- Keeps early delivery data concentrated.
- Makes message-angle results easier to interpret.
- Avoids false precision from many narrow audiences.
- Provides a stable structure that can map to Meta campaign/ad-set/ad objects.

Campaign names use:

```text
<business> | <offer> | <objective> | <YYYY-MM-DD>
```

The initial platform state is always `PAUSED`.

## 7. Audience construction

### 7.1 Supplied audience

When the user provides an audience hypothesis, the planner preserves it as the primary audience summary. It may add non-sensitive intent signals but must not invent protected personal attributes.

### 7.2 Missing audience

When no audience is supplied:

- Infer only a broad, problem-aware audience from the offer and geography.
- Add the `AUDIENCE_ASSUMED` warning.
- Make the assumption visible during review.
- Do not infer health status, race, religion, sexuality, political affiliation, financial hardship, or other sensitive traits.

### 7.3 Default delivery settings

- Geography: exact user-supplied geography.
- Age: broad adult range of 25–54 for the generic prototype.
- Placements: Facebook Feed, Instagram Feed, Instagram Stories, and Instagram Reels.
- Audience signals: problem awareness, recent category engagement, and high-intent site activity.

Provider-specific eligibility and special-ad-category rules must be added before real targeting is enabled.

## 8. Creative testing logic

Creative variants must test distinct hypotheses rather than superficial wording changes.

### Core angles

1. **Primary benefit** — clearly communicates the main product outcome.
2. **Problem and friction** — names the decision difficulty or pain and presents a simpler path.
3. **Use case** — places the product in a concrete, recognizable situation.
4. **Proof and confidence** — adds a trust mechanism such as product evidence, guarantee, demonstration, or verified proof. Used only in the scale-ready tier.

The lean tier uses benefit and problem. The validation tier adds use case. The scale-ready tier adds proof.

### Copy requirements

- Headline and primary text must align with the same angle.
- Copy must remain consistent with the supplied offer description.
- No invented discounts, statistics, reviews, guarantees, scarcity, or testimonials.
- No guaranteed performance claims.
- The destination page must reasonably support the advertised message.
- Brand voice affects expression, not factual content.

### Creative-brief requirements

Each ad includes a visual hypothesis describing:

- Subject or scene.
- Product/benefit emphasis.
- Recommended first-frame information.
- Tone.
- What makes the variant strategically different.

The prototype produces creative direction, not finished image or video assets.

## 9. Measurement logic

Every proposal defines:

- One primary optimization metric tied to the objective.
- Three diagnostic secondary metrics.
- Tracking requirements.
- An explicit statement that performance is not guaranteed.

Future optimization must use sufficient conversion and spend data. No automatic scaling rule may act solely on click-through rate.

## 10. Deterministic policy findings

### Hard blockers

- Daily budget exceeds workspace maximum.
- Campaign currency differs from account/workspace currency.
- Missing or invalid required brief data.
- Unsupported sensitive or regulated category in the prototype.
- Missing approval or approval/payload mismatch at execution.
- Requested initial state is anything other than paused.

### Warnings

- Audience was inferred.
- Destination does not use HTTPS.
- Daily budget is extremely low for meaningful testing.
- Duration is shorter than seven days.
- Tracking readiness has not been verified.

### Information

- Simulation mode cannot affect a real account.
- Platform delivery and policy review can still reject a technically valid campaign.

Warnings do not prevent approval. Blockers do.

## 11. Unsupported categories in the prototype

Until platform-specific compliance flows exist, the prototype blocks briefs that appear to involve:

- Political campaigns or elections.
- Housing opportunities.
- Employment opportunities.
- Credit, lending, or debt products.
- Prescription drugs or medical treatments.
- Gambling or betting.

This is a conservative product limitation, not a complete legal or provider-policy classifier.

## 12. Approval and execution

1. Generate a schema-valid proposal.
2. Run deterministic validation.
3. Display strategy, exact budget, assumptions, warnings, blockers, and execution structure.
4. Require explicit human approval of an immutable proposal hash.
5. Recheck policy immediately before execution.
6. Use an idempotency key for the external mutation.
7. Create provider objects in paused state.
8. Persist external identifiers and append audit events.

Any edit after approval creates a new revision and invalidates the previous approval.

## 13. Future LLM planner contract

The LLM receives:

- Normalized brief.
- Workspace policy summary without credentials.
- Supported objective definitions.
- Budget-tier decision.
- Allowed creative angles.
- Provider capability summary.

The LLM returns a strict `CampaignProposal` payload. It may write rationales, audience summaries, copy, and creative briefs. It may not change:

- Authorized budget.
- Currency.
- Workspace/account identity.
- Approval requirements.
- Initial paused state.
- Idempotency or authorization fields.

Malformed or out-of-policy output is rejected and never executed.

## 14. Change-management checklist

When changing campaign-building behavior:

1. Update this document.
2. Update typed rules in `src/lib/campaign-rules.ts`.
3. Update proposal generation in `src/lib/engine.ts`.
4. Add or update tests in `src/lib/engine.test.ts`.
5. Confirm the review UI explains the resulting decision.
6. Run type checking, linting, tests, and production build.
