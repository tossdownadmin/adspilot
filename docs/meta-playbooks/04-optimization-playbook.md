# Meta Ads — Optimization Playbook

The decision layer. Given a diagnosis (file 03), what does the system *do*? These are explicit, checkable rules for scaling winners, cutting losers, fixing the fixable, and doing it all without wrecking the learning phase. Every rule ends in a concrete tool call — and every spend-affecting call is **proposed to the user, then applied only on confirmation**, then verified.

Prime directives, applied to every action:

1. **Smallest correct change.** Address the named cause; don't shotgun five edits.
2. **One change at a time per ad set** (where you need to attribute the effect). Batch unrelated changes across *different* ad sets, but don't stack conflicting changes on the *same* one.
3. **Respect learning.** A significant edit resets the ~50-events / 7-day learning phase. So: don't edit daily, don't edit an ad set that's still learning, and give a change 3–7 days (and enough volume) before judging it.
4. **Never act on noise.** Below the volume floor, the action is "wait," not "optimize."
5. **Created = paused; activating = spending.** Confirm before you publish.

---

## 1. Scale a winner

**Trigger:** an ad set/campaign beating its KPI target and its own baseline, past the learning phase, with real volume.

Rules:
- **Raise budget gradually.** Increase by ~**20–30% at a time**, then wait 3–7 days to re-stabilize. Large jumps (doubling+) re-trigger learning and often tank efficiency temporarily. Tool: `ads_update_entity` (`daily_budget`/`lifetime_budget` on the ad set if ABO, or campaign budget if CBO).
- **Or scale horizontally** — duplicate the winning ad set to a new, non-overlapping audience (new geo, lookalike, broader). Avoids overloading one audience and creating fatigue. Watch for overlap (file 03, §C).
- **Feed winners more creative** — add fresh variants of the winning ad's angle to extend its runway before fatigue.
- For CBO campaigns, scaling is often just raising the campaign budget and letting Meta redistribute; you don't have to micromanage the split.

Anti-pattern: yanking budget up 3× the day a campaign looks good. You'll reset learning and lose the thing you were scaling.

---

## 2. Cut / fix a loser

**Trigger:** an ad set/ad spending past the learning phase and past the volume floor, with cost per result well above target and no improving trend.

Decision order — **diagnose the cause first (file 03, §B/4), then pick the matching fix.** Don't just pause blindly; a fixable setup problem shouldn't be thrown away.

- **Cause = creative miss (low CTR from the start):** pause the ad; the ad *set* may be fine. New creative → new ad (creatives are immutable). Tools: `ads_create_creative` → `ads_create_ad` → pause old via `ads_update_entity`.
- **Cause = fatigue (freq↑, CTR↓, CPC↑):** see §3.
- **Cause = funnel leak (CTR ok, CVR low):** the ads platform can't fix this — flag the landing page/offer to the user. Don't burn more budget optimizing a broken page.
- **Cause = wrong optimization goal / missing pixel:** you can't change objective on a live campaign and changing the ad-set optimization goal resets learning — usually rebuild the ad set correctly (new ad set with the right `optimization_goal` + `promoted_object`), then pause the old. 
- **Cause = audience too narrow / overlap:** consolidate ad sets or broaden targeting (§4).
- **Cause = genuinely just unprofitable** (right setup, enough data, still bad): pause it. `ads_update_entity` → `{"status":"PAUSED"}`. Reallocate its budget to winners.

Volume/learning guard: if it's still learning or under the floor, **do nothing yet** — cutting early throws away a verdict you haven't earned.

---

## 3. Creative fatigue

**Signature:** rising frequency alongside falling CTR and rising CPC/CPM on a fixed audience, over time. Confirm with the trend tool and the ratio pattern (file 02, §4).

Fixes, in rough order of preference:
- **Refresh the creative** — new variants (new hook, format, angle). The durable fix. New creative → new ad.
- **Widen the audience** — give delivery more people so the same person sees it less often. Broaden geo/age, add a lookalike, or move to broad/Advantage+.
- **Frequency cap** (for awareness/reach ad sets) via `frequency_control_specs`.
- **Rotate**, not just add — pause the worn ad so budget flows to the fresh one.

Prevention: keep a few creatives live per ad set and a refresh cadence, rather than waiting for the fatigue trio to appear.

---

## 4. Structure & targeting fixes

- **Consolidate fragmented/overlapping ad sets** into fewer, better-funded ones so each can exit learning and stop competing with itself. This alone often lowers costs on accounts that "spend but won't scale." (Confirm overlap via `ads_insights_auction_ranking_benchmarks`.)
- **Broaden over-narrow targeting.** On conversion goals, modern delivery usually beats hand-picked micro-interests with broad or Advantage+ audiences. Test broad against the incumbent rather than assuming.
- **Right creative count per ad set** — aim ~3–5 distinct creatives; not 1 (starves optimization), not 15 (splits volume, slows learning).
- **Fix budget placement** — move to CBO unless there's a specific reason to hand-control splits (ABO). Loosen bid caps that are choking delivery.

Because several of these reset learning, treat them as deliberate rebuilds: make the change, then leave it alone for the learning window before judging.

---

## 5. Bidding & budget strategy

Match the bid strategy to the goal (set on the campaign for CBO, on the ad set for ABO):

- **`LOWEST_COST_WITHOUT_CAP`** (auto-bid, the default) — maximize results for the budget; use when you want max volume and don't have a hard cost ceiling. No `bid_amount` needed.
- **`COST_CAP`** — target an average cost per result. Use when you have a CPA you must roughly hold. Requires `bid_amount` (the target, in cents).
- **`LOWEST_COST_WITH_BID_CAP`** — hard ceiling on each bid. Advanced; can throttle delivery if set too low. Requires `bid_amount`.
- **`LOWEST_COST_WITH_MIN_ROAS`** — value optimization with a floor ROAS. Requires `bid_constraints` (`roas_average_floor`, e.g. 200 = 2.0×) and a value-optimized goal (`VALUE`).

Guidance: start with `LOWEST_COST_WITHOUT_CAP` to gather data, then move to `COST_CAP`/min-ROAS once you know your true cost per result. A cost/bid cap set below what the auction actually clears will under-deliver — a common self-inflicted "it won't spend" problem. Budget minimums matter too: an ad set must be funded enough to reach ~50 events/week at its cost per result, or it never stabilizes.

---

## 6. Applying Opportunity Score recommendations

`ads_get_opportunity_score` returns prioritized, Meta-backed recommendations with an estimated point-lift and effect (e.g. "up to X% more results"). Workflow:
- Present them **sorted by point-lift** (highest first); describe lift as *points*, and the benefit via the effect estimate.
- Common recommendation types: enable Advantage+ audience, enable automatic placements, switch to CBO, scale a good campaign, consolidate.
- If a recommendation carries a `recommendation_signature`, it can be applied programmatically via `ads_update_entity`; otherwise direct the user to the provided Ads Manager `url`.
- Still gate anything that changes spend behind confirmation.

---

## 7. Prove it, don't guess — experiments

When the question is "which of these actually wins" or "did the ads truly cause the sales," stop eyeballing overlapping ad sets and run a clean test:
- **A/B split test** (`ads_experiment_abtest_create_test`) — one variable changed, clean audience split, head-to-head. Use for creative vs creative, audience vs audience, CBO vs ABO.
- **Conversion lift** (`ads_experiment_lift_create_test`, check `ads_experiment_check_eligibility` first) — measures incremental conversions against a holdout. The real answer to incrementality, which reported ROAS overstates.

---

## 8. The optimization loop, end to end

1. **Audit** (file 03) → ranked findings, each with a named cause.
2. **Map** each cause to a rule above → a specific tool action.
3. **Sequence** — do the highest-impact, lowest-risk fixes first; don't stack conflicting edits on one ad set.
4. **Propose** spend-affecting changes to the user with the expected effect; **apply on confirmation** (`ads_update_entity` / `ads_activate_entity`).
5. **Wait** the learning window (3–7 days) and enough volume before judging.
6. **Re-measure** (`ads_get_ad_entities`, `ads_insights_performance_trend`) → back to step 1.

The whole system is this loop, run continuously, with judgment at each step and a human gate on every dollar that moves. That gate — plus respecting learning and never acting on noise — is what separates a system that optimizes from one that just thrashes the account.
