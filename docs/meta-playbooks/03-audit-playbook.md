# Meta Ads — Audit Playbook

How the system should audit an account or a campaign: what to pull, in what order, what "good" and "broken" look like, and how to separate an observation ("CPA rose 30%") from a cause ("frequency hit 5 and CTR halved"). Two audits here: the **account audit** (top-down health check) and the **campaign audit** (deep single-campaign review). Both output findings, not just numbers.

Golden rule throughout: **observe → baseline → diagnose → recommend.** Never jump from a moved metric straight to an action without a stated cause.

---

## A. Account audit (the 12-point sweep)

Run these in order. Each step names the tool and what you're looking for.

### Step 1 — Confirm the account is real and queryable
`ads_get_ad_accounts`. Check `is_queryable`; note `currency`, `timezone`, `min_daily_budget_cents`. If not queryable, stop and report `not_queryable_reason`. Everything downstream assumes the account currency/timezone — carry them.

### Step 2 — Pull the account-level shape
`ads_get_ad_entities` at `level=ad_account`, last 30 days vs the prior 30 (two calls, or a comparison window). Get spend, impressions, reach, results, the objective mix. This is the "vital signs" snapshot and the baseline for every later comparison.

### Step 3 — Get Meta's own recommendations
`ads_get_opportunity_score`. Record the score and the ranked recommendations with their point-lift. This is the single highest-confidence "what to fix" input — but it's account-level guidance, not per-campaign truth.

### Step 4 — Trend direction
`ads_insights_performance_trend`. Are CPC/CPM/CPR/ROAS/CTR/CVR trending up or down over the available history? A healthy account has stable-or-improving cost KPIs. A worsening trend is the thread you'll pull in the campaign audit.

### Step 5 — Anomalies
`ads_insights_anomaly_signal`. Any sudden spikes/drops flagged. Treat each as a lead to investigate, not a conclusion.

### Step 6 — Delivery blockers
`ads_get_errors` across active entities. Anything rejected, in policy review, or failing to publish. A "great" account with three rejected ads is silently wasting reach.

### Step 7 — Campaign-level performance table
`ads_get_ad_entities` at `level=campaign`, with the KPI fields for each campaign's objective, sorted by spend. This tells you where the money is going and which campaigns carry the account. Flag: campaigns spending with no results; campaigns with results far above/below the account baseline.

### Step 8 — Structure sanity check
From the campaign/ad-set list, assess structure (see §C — Structural red flags). Too many tiny ad sets, overlapping audiences, one-ad ad sets, CBO vs ABO consistency.

### Step 9 — Audience overlap & auction health
`ads_insights_auction_ranking_benchmarks`. High overlap between ad sets = self-competition, under-delivery, wasted budget. A top structural finding for accounts that "spend but don't scale."

### Step 10 — Signal/tracking health (conversion accounts)
`ads_get_datasets` → `ads_get_dataset_quality`. Pixel present? Match rate healthy? Key events (Purchase, Lead) firing? A conversion campaign on a broken/low-quality signal is optimizing blind — this is often the real root cause behind "bad performance."

### Step 11 — Catalog health (if applicable)
For catalog/dynamic-ad accounts: `ads_catalog_get_diagnostics` + `ads_catalog_get_dynamic_ads_health`. Feed staleness or empty product sets masquerade as targeting/creative problems.

### Step 12 — Benchmark against peers
`ads_insights_industry_benchmark` on the main ad sets, matched by optimization goal and spend tier. Converts "here are our numbers" into "here's how we stack up."

**Account audit output:** a health score/summary, the 3–5 biggest issues ranked by impact (lean on Opportunity Score's point-lift), and for each: the observation, the likely cause, and the recommended fix (which flows into file 04).

---

## B. Campaign audit ("what's performing, what's not")

When one campaign is the focus, go deep. The method is **drill down the hierarchy** — campaign → ad set → ad — because a campaign average hides everything.

### Step 1 — Campaign vitals vs its own goal
`ads_get_ad_entities` level=campaign, entity scoped, current period vs prior. Is it hitting its KPI (the right one for its objective — file 02, §2)? By how much, and which direction is it moving?

### Step 2 — Ad-set breakdown (find the spread)
`ads_get_ad_entities` level=adset, filtered to this campaign, sorted by cost-per-result. This is where "what's not performing" surfaces: in almost every campaign a minority of ad sets carry the results and a few are dead weight. Identify:
- **Winners** — below-baseline cost per result, enough volume to trust.
- **Losers** — spending with high/no results, past the learning phase.
- **Undecided** — still learning or below the volume floor; leave alone.

### Step 3 — Ad breakdown (find the creative story)
`ads_get_ad_entities` level=ad within the winning/losing ad sets, sorted by cost per result and by link CTR. Creative is usually the biggest performance lever. Identify the ad(s) doing the work and the ones dragging.

### Step 4 — Diagnose each loser with the ratio patterns
For every underperformer, pull CTR, CVR, frequency, CPM, landing-page-view rate and apply the combination patterns (file 02, §4). Name the cause:
- fatigue (freq↑, CTR↓, CPC↑),
- creative miss (CTR↓ from the start),
- funnel leak (CTR ok, CVR↓),
- page problem (clicks ≫ LPVs),
- delivery/auction (under-pacing, overlap),
- signal problem (conversion event weak/missing).

### Step 5 — Check what changed
`ads_account_get_activity_logs` scoped to the campaign. Did a budget change, targeting edit, or creative swap line up with the performance shift? Correlating the change log with the metric timeline is often the fastest route to root cause — and it catches "someone reset the learning phase last Tuesday."

### Step 6 — Confirm nothing's blocked
`ads_get_errors` on the campaign's entities. An underperforming ad set may simply have a rejected ad.

**Campaign audit output:** for the campaign — is it winning or not, on the right KPI, vs its own baseline; a ranked list of ad sets and ads (keep / cut / watch); and for each problem a named cause tied to the fix in file 04.

---

## C. Structural red flags (spot these anywhere)

These are setup problems that suppress performance regardless of creative or budget. A good auditor catches them on sight:

- **Audience fragmentation** — many small ad sets slicing one audience. They compete in the same auction (raising your own costs), each struggles to exit the learning phase, and budget scatters. Fix: consolidate; let Meta's delivery and broad/Advantage+ targeting do the splitting.
- **Overlapping audiences** — ad sets targeting substantially the same people. Confirmed via `ads_insights_auction_ranking_benchmarks`. Same effect as fragmentation.
- **One ad per ad set** — starves Meta's creative optimization. It needs a few (≈3–5) distinct creatives per ad set to test and pick winners. Too many (10+) splits volume and slows learning.
- **Sub-scale budgets** — ad-set daily budget too low to ever hit ~50 events/week at the current cost per result. Such ad sets never leave learning and never stabilize. Either fund them to escape velocity or consolidate.
- **CBO/ABO confusion** — mixed or contradictory budget placement, or manual bid caps set so tight nothing delivers.
- **Objective/optimization-goal mismatch** — e.g. a sales goal optimizing for `LINK_CLICKS` instead of `OFFSITE_CONVERSIONS`, so Meta chases cheap clicks that never buy. Or a conversion ad set with no pixel in `promoted_object`.
- **Wrong or missing signal** — optimizing for `PURCHASE` when the pixel only reliably fires `PageView`; or a low dataset match rate. The whole campaign is steering on a bad compass.
- **Too-narrow targeting on a conversions goal** — modern Meta delivery generally does better with broad/Advantage+ audiences than hand-picked micro-interests. Over-narrow targeting is a frequent, invisible cost inflator.
- **Ignoring the learning phase** — frequent edits keep resetting it. If the change log shows constant tweaking, that itself is the problem.

---

## D. The audit stance (how to phrase findings)

- **Separate observation from cause, always.** "Cost per purchase rose 34% week-over-week" is an observation. "…because frequency climbed to 4.8 and link CTR fell by half — creative fatigue" is the cause. Recommendations attach to causes.
- **Rank by impact, not by ease.** Lead with the finding that moves the most money. Opportunity Score's point-lift is a good proxy for ordering when you're unsure.
- **Respect volume and learning.** Don't flag an ad set that's still learning or below the volume floor. "Not enough data yet" is a valid, honest finding.
- **Tie every recommendation to a specific tool action** so the optimize step (file 04) can execute it — and remember any spend-affecting action is *proposed*, then applied only on confirmation.
