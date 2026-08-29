# Meta Ads — Metrics Glossary & How to Read Them

An AI system is only as good as its ability to tell a good number from a bad one. This file defines the metrics, tells you which one is the *real* KPI for each objective, and explains how to think about benchmarks (the honest answer: mostly, compare to the account's own history).

---

## 1. The metric families

### Cost & spend
- **Spend / `amount_spent`** — money spent in the period. The denominator of everything.
- **CPM (`cpm`)** — cost per 1,000 impressions. What it costs to *show* the ad. Driven by auction competition, audience, placement, season, and creative quality. A surface metric — high CPM is not automatically bad if results are cheap.
- **CPC (`cpc`)** — cost per click. `cpc` counts all clicks; **cost per *link* click** (`cost_per_link_click`) counts only clicks to your destination and is the more honest traffic-cost number.
- **CPP (`cpp`)** — cost per 1,000 people reached (cost per reach), vs CPM which counts impressions (a person can be reached once but see the ad many times).

### Volume & reach
- **Impressions (`impressions`)** — times the ad was shown (can repeat per person).
- **Reach (`reach`)** — unique people who saw it.
- **Frequency (`frequency`)** = impressions ÷ reach. Average times each person saw it. **A fatigue signal** — see §4.
- **Clicks (`clicks`)** vs **Link clicks (`link_click` / `outbound_clicks`)** — total interactions vs clicks that actually go to your site.

### Rate / quality
- **CTR (`ctr`)** — clicks ÷ impressions. Overall click rate. **Link CTR** / `outbound_clicks_ctr` (link clicks ÷ impressions) is the cleaner creative-relevance signal.
- **CVR (conversion rate)** — conversions ÷ clicks (or ÷ landing-page views). How well the click→action step converts. Low CVR with healthy CTR usually points at the landing page or offer, not the ad.
- **Landing page view rate** — landing-page views ÷ link clicks. A big gap (clicks ≫ LPVs) means the page is slow or people bounce before it loads.

### Outcome (the ones that pay the bills)
- **Results / cost per result (`results`, `cost_per_result`)** — count of the ad set's optimization event and its unit cost. The generic "did we get the thing we optimized for, and how cheap." **`cost_per_result` is not available at account level** (an account can mix result types) — use campaign level.
- **Purchases & value** — `omni_purchase` / `offsite_conversion_fb_pixel_purchase` (count), `omni_purchase_values` / purchase conversion value (revenue).
- **ROAS (`purchase_roas` / `website_purchase_roas` / `result_roas`)** — revenue ÷ spend. The headline metric for e-commerce/sales. 2.0 means $2 back per $1 spent. Judge against the account's break-even ROAS (1 ÷ margin), not a universal target.
- **Leads & cost per lead (`lead`, `cost_per_lead`, `onsite_conversion_lead_grouped`)** — for lead-gen.
- **Add-to-cart / checkout / registration** — mid-funnel events (`omni_add_to_cart`, `omni_initiated_checkout`, `omni_complete_registration`) and their `cost_per_*`. Useful for locating *where* a funnel leaks.

### Video engagement
- `video_play_actions`, `video_thruplay_watched_actions` (15s or full), `video_avg_time_watched_actions`, and quartiles `video_p25/p50/p75/p95/p100_watched_actions`. The quartile drop-off curve tells you where viewers leave — a cliff at p25 means a weak hook.

---

## 2. Which metric is the KPI? (match to objective)

**Judging a campaign on the wrong metric is the most common analytical error.** Map objective → primary KPI → supporting metrics:

| Campaign objective | Primary KPI | Supporting / diagnostic |
|---|---|---|
| `OUTCOME_SALES` | ROAS, cost per purchase | CVR, add-to-cart cost, AOV, link CTR |
| `OUTCOME_LEADS` | Cost per lead (and lead *quality* downstream) | CVR, landing-page-view rate, link CTR |
| `OUTCOME_TRAFFIC` | Cost per link click, link CTR | Landing-page-view rate, bounce |
| `OUTCOME_ENGAGEMENT` | Cost per result (the engagement type) | CTR, frequency |
| `OUTCOME_AWARENESS` | CPM / cost per reach, reach | Frequency, ad recall lift |
| `OUTCOME_APP_PROMOTION` | Cost per install / in-app action | CVR, retention (downstream) |

Rule: **never crown or condemn a campaign on CPM alone.** High CPM with strong ROAS is fine. Low CPM with no conversions is not. Always walk down to the outcome metric for the objective.

---

## 3. How to think about benchmarks (read this carefully)

There is no universal "good CTR" or "good CPM." The numbers below are **loose orientation only** and swing enormously by:

- **Country.** CPMs in the US/Canada run many times higher than in Pakistan or much of South/Southeast Asia. A "$15 CPM = expensive" instinct from a US account is meaningless for a Lahore-served campaign. Compare within-geo.
- **Objective & optimization goal.** A conversions ad set and a reach ad set are not comparable.
- **Industry, offer, season.** Q4 retail auctions spike; a niche B2B lead costs more than an app install.

So the ranking of trustworthiness for "is this good?" is:

1. **The account's own trailing baseline** (same campaign/objective, prior period). This is ground truth. Always compute it first via `ads_get_ad_entities` with a comparison `time_range`.
2. **`ads_insights_industry_benchmark`** — peers with the same optimization goal and spend tier. Use for external context.
3. **Generic ranges** (below) — only as a last-resort sanity check, never as a verdict.

Very rough generic ranges (assume wide variance; verify against 1 and 2):
- Link CTR: ~0.5%–2%+ is a common band; sustained <0.5% suggests weak creative/targeting fit.
- CVR (click→purchase, e-comm): frequently ~1%–3%.
- Frequency: under ~2–3 over a week is usually comfortable; climbing past that on a fixed audience signals fatigue.
- ROAS: judge against break-even = 1 ÷ gross margin, not a fixed multiple.

If you hardcode any of these as thresholds in your system, gate them behind the account's own baseline so a healthy campaign in a cheap-CPM market isn't flagged as broken.

---

## 4. Reading combinations (this is where diagnosis lives)

Single metrics rarely tell the story; ratios and pairs do. The high-value patterns:

- **High CTR + low CVR** → the ad works, the landing page or offer doesn't. Fix the page/offer, not the creative.
- **Low CTR + low CVR** → creative/targeting mismatch. The ad isn't earning the click. Fix creative or audience.
- **Good CVR + rising cost per result** → usually rising CPM (auction/competition) or fatigue, not a funnel problem. Check CPM trend and frequency.
- **Rising frequency + falling CTR + rising CPC** → **creative fatigue.** The classic trio. Refresh creative or widen audience (file 04, §Creative fatigue).
- **Clicks ≫ landing-page views** → page speed / load / redirect problem. Technical, not creative.
- **Spend not pacing (under-delivering)** → audience too small, bid/cost cap too tight, ad sets overlapping and self-competing, or entity not fully active. Check `ads_get_errors` and `ads_insights_auction_ranking_benchmarks`.
- **Volatile daily results on low volume** → **noise, not signal.** Below ~50 optimization events/week the ad set is in or near the learning phase; don't react to daily swings.

---

## 5. Statistical honesty — don't react to noise

Two guardrails your system must enforce before it draws any conclusion:

- **Learning phase.** After creation or a significant edit, an ad set is "learning" until it accrues roughly **50 optimization events in ~7 days**. Metrics are unstable here; judgments are unreliable; and every significant edit **resets** learning. This is why file 04 says: batch changes, don't tweak daily.
- **Minimum volume for a verdict.** A CTR computed on 40 impressions or a ROAS on 2 purchases is not evidence. Set a floor (e.g. enough impressions/clicks/results to be meaningful) before comparing or acting. When volume is below the floor, the correct output is "not enough data yet," not a recommendation.

---

## 6. Attribution — know what the number counts

A reported conversion depends on the **attribution window** (default 7-day click + 1-day view). Meta counts a conversion if it happened within that window after a click/view. Implications your system should state, not hide:

- Meta's reported ROAS is typically **higher** than a last-click analytics tool, because view-through and longer click windows capture more.
- Two tools disagreeing isn't necessarily a bug — they attribute differently.
- iOS/ATT and signal loss make click-based measurement noisier; this is why Meta pushes the pixel/CAPI signal quality (`ads_get_dataset_quality`) and, for true causality, **lift studies** over reported ROAS.

When you report a conversion number, note the window it's measured on. When two sources conflict, explain the attribution difference rather than asserting one is "wrong."
