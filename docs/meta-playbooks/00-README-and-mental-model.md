# Meta Ads Agent — System Knowledge Pack

This is a set of reference files that let an AI-driven system operate a Meta (Facebook/Instagram) ad account the way a capable human media buyer would: read performance, audit an account, diagnose what's working and what isn't, create and edit campaigns, and optimize. Feed these files to your model as system/context knowledge.

The files:

| File | What it covers |
|---|---|
| `00-README-and-mental-model.md` | The data model, the agent loop, auth/scopes, and rules that apply to *every* call. Read first. |
| `01-tool-reference.md` | The full toolset by category, with real parameter schemas for the core-loop tools. |
| `02-metrics-glossary.md` | Every metric, what it means, how to read it, and how to think about benchmarks. |
| `03-audit-playbook.md` | Step-by-step account audit and campaign audit. "What's performing, what's not." |
| `04-optimization-playbook.md` | Decision rules: scale, cut, fix. Creative fatigue, budget, bidding, learning phase. |

A note on accuracy: parameter names and enum values here are taken from the live tool schemas. The Meta Marketing API changes; before shipping, verify field names against the current API and treat the benchmark ranges in file 02 as orientation, not truth. The account's own trailing history is always the real baseline.

---

## 1. The mental model: a 4-level hierarchy

Everything in Meta Ads is a tree with four levels. Get this straight and 80% of the system's logic falls into place.

```
Ad Account          (the container — holds budget, billing, currency, pixels, audiences)
  └── Campaign      (holds the OBJECTIVE — what business outcome you're buying)
        └── Ad Set  (holds AUDIENCE, BUDGET*, PLACEMENTS, SCHEDULE, OPTIMIZATION GOAL, BID)
              └── Ad (holds the CREATIVE — the image/video/text the user actually sees)
```

What each level decides:

- **Ad Account** — identity and money. Currency, timezone, spend limit, payment method, and the shared assets that live here: the pixel/dataset, custom audiences, catalogs, Pages. One business can have several ad accounts.
- **Campaign** — the *objective*. This is the single most consequential choice; it constrains everything below it. Meta's current objectives (called ODAX / "Outcome" objectives) are exactly six: `OUTCOME_AWARENESS`, `OUTCOME_TRAFFIC`, `OUTCOME_ENGAGEMENT`, `OUTCOME_LEADS`, `OUTCOME_SALES`, `OUTCOME_APP_PROMOTION`. Budget *can* live here (see CBO below).
- **Ad Set** — the "how and to whom." Who sees it (targeting), where (placements), when (schedule), how much (budget, if ABO), and what Meta optimizes delivery toward (the optimization goal, e.g. `OFFSITE_CONVERSIONS`, `LINK_CLICKS`, `LEAD_GENERATION`).
- **Ad** — the "what." The creative. Note: **ad creatives are immutable.** You do not edit an ad's image/headline/text. To change creative you create a *new* creative, then a *new* ad pointing to it, then pause the old one.

### Budget lives in one of two places — CBO vs ABO

- **CBO (Campaign Budget Optimization)** — budget sits on the **campaign**; Meta distributes it across ad sets automatically. This is Meta's recommended default. Set `campaign_daily_budget` or `campaign_lifetime_budget` on the campaign.
- **ABO (Ad Set Budget Optimization)** — budget sits on **each ad set**; you control the split by hand. Set `daily_budget` or `lifetime_budget` on the ad set, and leave the campaign budget unset.

A campaign is one or the other, not both. Setting any campaign-level budget field switches it to CBO. Under a CBO campaign, ad-set-level budget and bid fields are rejected — bidding and budget are governed at the campaign level.

---

## 2. The agent loop

Every task the system performs is a walk of the same loop. Design your agent around it.

1. **Resolve the account.** Get the ad account ID. Confirm it's usable before querying (`ads_get_ad_accounts` → check `is_queryable`; if false, surface `not_queryable_reason` instead of pushing forward).
2. **Read before you write.** Pull the current state — entities, metrics, errors, recommendations — before making any change. You cannot optimize what you haven't measured.
3. **Diagnose.** Compare against the goal, the account's own trailing baseline, and peer benchmarks. Separate *observations* (a metric moved) from *causes* (why). See file 03.
4. **Decide.** Map the diagnosis to an action using explicit rules (file 04). Prefer the smallest change that addresses the cause.
5. **Act — but stage, don't fire.** Everything you create is born **PAUSED**. Creating a campaign/ad set/ad never spends money. Publishing is a separate, explicit step (`ads_activate_entity`) that must be gated behind human confirmation, because that's the moment money starts moving.
6. **Verify.** Re-read. Check for delivery-blocking errors. Confirm the change took effect. For a new conversion setup, verify the event actually fires before trusting it.

The hard rule that makes this safe: **reads are free and reversible; writes that activate spend are not.** Gate step 5 behind explicit user approval, always.

---

## 3. Auth and scopes (what your Meta app needs)

Your system authenticates as a Meta app that each user (advertiser) authorizes via Facebook Login. The app requests OAuth *scopes* (permissions); the user's granted token is what every API call rides on. The relevant scopes:

- **`ads_read`** — read campaigns, ad sets, ads, insights/metrics, audiences. Everything in the audit and reporting path needs only this. If your product is read-only analytics, stop here — it's a lighter review from Meta.
- **`ads_management`** — create, edit, pause, activate, delete. Every write in file 04 needs this. This is the "create and manage ads" permission.
- **`business_management`** — manage Business Manager assets (Pages, pixels/datasets, audiences at the business level, user roles). Needed if you touch pixel event rules, catalogs, or business-owned assets.
- **`pages_show_list` / `pages_read_engagement`** (and related Page scopes) — to list and use the Pages that ads are published under. Every ad creative needs a `page_id`; you need Page access to get it.
- **`catalog_management`** — only if you do dynamic/catalog ads (product feeds, product sets).

Two gates beyond scopes, both of which trip up new builders:

- **App Review.** Advanced access to `ads_management`, `business_management`, etc. requires Meta's App Review before real (non-admin) users can grant them. During development, your own admin/test users work without review.
- **Business verification** and a registered **System User token** (for server-to-server automation that isn't tied to a person logging in). Long-running automation usually runs on a System User token rather than a short-lived user login.

Token hygiene: store one token per advertiser, refresh long-lived tokens before expiry, and never reuse one advertiser's token for another's account.

---

## 4. Conventions that apply to EVERY call

These are easy to miss and each one is a common source of failed calls. Bake them into your client layer so the model doesn't have to remember them.

- **Account ID format.** The numeric ID, without the `act_` prefix, in these tools (e.g. `123456789`, not `act_123456789`). The raw Graph API uses `act_` — mind the boundary.
- **Money is in minor units (cents).** Every budget, bid, and spend cap is an integer in the account currency's smallest unit. $50.00 → `5000`. For a zero-decimal currency this differs — check the account currency. Read the per-currency minimum daily budget (`min_daily_budget_cents` from the accounts call) before setting a budget; below-minimum values are rejected.
- **Created = PAUSED.** Campaigns, ad sets, and ads are always created paused. Nothing delivers until explicitly activated, top-down (campaign → ad set → ad). Activating a child under a paused parent "succeeds" but won't deliver.
- **Verify fields before requesting them.** For the reporting tool (`ads_get_ad_entities`), field availability is level-scoped and the API is strict — a field valid at campaign level may not exist at ad level. Verify names with `ads_get_field_context` before passing them in `fields`, `filtering`, or `sort`. Don't invent field names, operators, or enum values.
- **`client_conversation_id`.** Most tools accept this: a single 20-character alphanumeric ID that you generate once per advertiser conversation and then send unchanged on every subsequent call in that conversation. It groups calls for tracing. Generate a fresh one only when a genuinely new conversation starts.
- **`advertiser_request`.** Many tools accept the advertiser's request in their own words. Pass the user's actual phrasing, not your paraphrase or the technical operation name. It's used for context/telemetry, not control.
- **Immutable creatives.** Restated because it bites people: never try to edit an ad's creative via an update. New creative → new ad → pause old.
- **Objective is set once.** Chosen at campaign creation; you can't meaningfully change a live campaign's objective. Wrong objective = new campaign.

---

## 5. What "acting like the MCP" actually means

The tools are only half of it. The other half — the part that makes the difference between a system that *can* call the API and one that *runs ads well* — is judgment:

- Knowing which metric is the real KPI for a given objective (a Traffic campaign is judged on CPC/CTR/landing-page-view rate; a Sales campaign on ROAS and cost per purchase — never on CPM alone).
- Comparing against the right baseline (the account's own last-period numbers first; peer benchmarks second; never a number pulled from the air).
- Distinguishing a signal from noise (a metric that moved on 40 impressions means nothing; the learning phase needs ~50 optimization events per week before results stabilize).
- Preferring the smallest correct intervention, and never stacking five changes at once so you can't tell which one worked.

Files 03 and 04 encode that judgment as explicit, checkable rules. That's the brain. The tools are the hands.
