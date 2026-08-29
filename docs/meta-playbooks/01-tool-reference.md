# Meta Ads — Tool Reference

The toolset splits into functional groups. The tools you'll use in 90% of audit-and-optimize work are the **Reading**, **Insights**, **Management**, and **Diagnostics** groups — those are documented with full parameter schemas below. The catalog, pixel/dataset, and experiment groups are listed by name and purpose; pull their exact schemas from the live tool definitions when you build against them (don't guess parameter names — Meta's specs are strict and reject unknown fields).

Universal parameters (omitted from the per-tool lists below to avoid repetition): `client_conversation_id` and `advertiser_request` are accepted by almost every tool — see file 00, section 4.

---

## GROUP A — Reading entities & performance (the workhorses)

### `ads_get_ad_accounts`
Lists the ad account IDs the token can access. **Call this first.** Returns per-account: `is_queryable` (whether you can pull data), `not_queryable_reason`, `currency`, `min_daily_budget_cents`, timezone. Always check `is_queryable` before querying an account.

### `ads_get_ad_entities` — the single most important read tool
Retrieves campaigns, ad sets, ads, or account-level rows **with their performance metrics**, filtered and sorted. This is how you pull "what's performing." Key parameters:

- `ad_account_id` (required) — numeric, no `act_`.
- `level` — `ad_account` | `campaign` | `adset` | `ad`. Set this to match the scope the user implies. Account level does **not** support filtering or sorting.
- `fields` (array) — metrics/attributes to return. Defaults to `id, name, amount_spent` if omitted. **Verify every field with `ads_get_field_context` first** — fields are level-scoped. See file 02 for the full field catalog.
- `filtering` (array) — each filter is `{"field":..., "operator":..., "value":[...]}`. Value is always an array of strings. Operators include `IN`, `CONTAIN`, `CONTAINS_ANY`, `GREATER_THAN`, `IN_RANGE`. Example: `{"field":"effective_status","operator":"IN","value":["ACTIVE"]}`. Not supported at account level.
- `sort` — a string like `impressions_descending` (field + direction, underscore-joined). To get both top and bottom performers, call twice with opposite directions.
- `date_preset` — one of: `today, yesterday, this_month, last_month, this_quarter, last_3d, last_7d, last_14d, last_28d, last_30d, last_90d, last_week_mon_sun, last_week_sun_sat, last_quarter, last_year, this_week_mon_today, this_week_sun_today, this_year, maximum, data_maximum`. Defaults to last 28 days.
- `time_range` — `{"since":"YYYY-MM-DD","until":"YYYY-MM-DD"}` as a JSON string. Don't pass both this and `date_preset`.
- `time_increment` — string: `"1"`–`"90"`, `"monthly"`, or `"all_days"`. Use for day-by-day trend rows.
- `breakdowns` (array) — split metrics by dimension (e.g. age, gender, placement, platform, country). Multiple compatible breakdowns allowed.
- `object_state` — `live` (default, published + metrics) or `draft` (unpublished staged changes, no metrics).
- `cursor`, `limit` — pagination. Resend all other params unchanged when passing a cursor.

The response carries a `next_actions` field — an ordered list of recommended follow-up calls (what's trending, what's blocked, what to change) with ready-to-use args and safety flags. Read-only next-actions are safe to run automatically; ones flagged `requires_user_confirmation` (anything that affects spend) must be proposed for approval.

### `ads_get_field_context`
Returns canonical metadata for any reporting field: its real name, display name, which levels it's valid at, whether it's filterable/sortable, allowed operators, and enum values. **Call before using an unfamiliar field.** Use its canonical `name` in requests and its `display_name` in output to the user.

### `ads_account_get_activity_logs`
The change history of the account — who changed what, when (budget changes, status flips, targeting edits, creative swaps), including Meta system-generated changes. Filter by `event_category` (account, ad, ad_set, audience, bid, budget, campaign, date, status, targeting), `object_id`, `user_id`, and a time window. Use it to answer "what changed last week?" and to correlate a performance shift with an edit.

### Supporting reads
- `ads_get_ad_account_pages` / `ads_get_user_pages` / `ads_get_pages_for_business` — the Pages you can advertise under. Every creative needs a `page_id`.
- `ads_get_ig_accounts` / `ads_get_ig_media` — Instagram accounts and advertisable IG posts.
- `ads_get_ad_images` / `ads_get_ad_videos` — media already uploaded to the account's library (returns `image_hash` / video IDs to reference in creatives).
- `ads_get_creatives` / `ads_get_creative_ads` — existing creatives and the ads using them.
- `ads_get_customconversions` — custom conversions defined on the account.
- `ads_get_datasets` / `ads_get_dataset_details` / `ads_get_dataset_stats` / `ads_get_dataset_quality` — the pixel/dataset(s): identity, event volume, and **signal quality** (match rate, health). Dataset quality is central to conversion-campaign audits.

---

## GROUP B — Insights & diagnosis (the analyst tools)

These five turn raw metrics into judgment. All take `ad_account_id` and an optional `entity_ids` array (to scope to specific campaigns/ad sets/ads — all same type). Several also take `conversation_intent` and `conversation_topic` enums that route the analysis; set them from the user's goal.

### `ads_get_opportunity_score`
Account-level score 0–100 plus **prioritized, actionable recommendations** backed by Meta's own analysis, each with an estimated score lift (in "points") and an effect estimate (e.g. "up to 3% more traffic"). This is the highest-confidence source of "what to change." Call it proactively whenever the user asks how to improve, what's wrong, or what to do next. The score is **always account-level** — never attribute it to one campaign. Some recommendations carry a `recommendation_signature` and can be applied programmatically via `ads_update_entity`.

### `ads_insights_anomaly_signal`
Flags unusual deviations — spikes, drops, unusual patterns — at account/campaign/ad-set/ad level. Use for "what's wrong?" / "why did performance change suddenly?" Treats findings as *areas to investigate*, not conclusions. Note: it surfaces performance *variance*, not setup/policy/publish errors (use `ads_get_errors` for those).

### `ads_insights_performance_trend`
Time-series direction of the core KPIs (CPC, CPM, CPR, ROAS, CTR, CVR, reach) — is each getting better or worse over the available history. Takes no date range (it uses full history; for a specific window use `ads_get_ad_entities`). `analysis_level` is `AD` or `ADSET`; `analysis_metric` narrows to one named KPI. If the response includes a `scorecard`, an interactive card is already shown to the user — don't restate it, add the takeaway and cause.

### `ads_insights_auction_ranking_benchmarks`
Diagnoses **auction competitiveness**: which ads win the auction more, and whether bid or ad quality is the lever. Flags high **audience overlap** between ad sets (which causes self-competition, under-delivery, and budget fragmentation) and recommends consolidation. This is your tool for "why isn't this delivering?" when spend is stuck.

### `ads_insights_industry_benchmark`
Compares ad-set performance against aggregated peers, optionally filtered by spend tier (`cas_segment`) and optimization goal. The guidance baked in: compare on **business-outcome metrics** (cost per result, ROAS) not surface metrics (CPM), and only compare objects with the same optimization goal and conversion event. Use to answer "is this good?" relative to similar advertisers.

### `ads_insights_advertiser_context`
An overview of the advertiser's business and funnel to help pick the right optimization goal and approach. Useful as a first call when you don't yet know what the account is trying to do.

---

## GROUP C — Diagnostics & errors

### `ads_get_errors`
Delivery-**blocking** errors on a campaign, ad set, or ad — the reasons something isn't running (policy rejections, setup problems, publish failures). Distinct from anomaly signals (which are about performance variance). Any audit of a non-delivering entity starts here.

### `ads_get_ad_preview`
Renders how a creative will actually appear across placements (Facebook feed, Instagram, Stories, Reels, etc.). Use to sanity-check a creative before or after publishing.

### `ads_library_search`
Searches Meta's public Ad Library — any advertiser's currently running ads. Use for competitor creative research.

---

## GROUP D — Creating & managing entities (the write path)

Everything here needs `ads_management`. Everything created is **PAUSED**.

### `ads_create_campaign`
Creates a paused campaign. Required: `ad_account_id`, `campaign_name`, `objective` (one of the six ODAX outcomes), `buying_type` (`AUCTION` default). For **CBO**, set `campaign_daily_budget` or `campaign_lifetime_budget` (cents) and optionally `campaign_bid_strategy` (`LOWEST_COST_WITHOUT_CAP` default, or `LOWEST_COST_WITH_BID_CAP`, `COST_CAP`, `LOWEST_COST_WITH_MIN_ROAS`). For **ABO**, leave all campaign-budget fields unset. `special_ad_categories` must be set (e.g. `["HOUSING"]`, `["CREDIT"]`, `["EMPLOYMENT"]`, political) when applicable — legally required and it constrains targeting. The response returns `valid_optimization_goals` and a `recommended_optimization_goal` for the objective — **use these for the ad set**.

### `ads_create_ad_set`
Creates a paused ad set. Required: `ad_account_id`, `campaign_id`, `ad_set_name`, `billing_event` (`IMPRESSIONS` | `LINK_CLICKS` | `POST_ENGAGEMENT` | `VIDEO_VIEWS`), `optimization_goal`, `targeting` (JSON). Highlights:
- **`optimization_goal`** must be compatible with the parent objective. Defaults per objective: Awareness→`REACH`, Traffic→`LINK_CLICKS`, Engagement→`THRUPLAY`, Leads→`OFFSITE_CONVERSIONS`, Sales→`OFFSITE_CONVERSIONS`, App→`APP_INSTALLS`. Use a value from the campaign's returned valid list.
- **`promoted_object`** is required for conversion goals: `OFFSITE_CONVERSIONS`, `VALUE`, `LEAD_GENERATION`, `QUALITY_LEAD`, `APP_INSTALLS`, `IN_APP_VALUE`. E.g. `{"pixel_id":"123","custom_event_type":"PURCHASE"}`. An `OUTCOME_SALES` + website ad set without a pixel in `promoted_object` is rejected.
- **`targeting`** — JSON spec. **Never invent interest IDs** (they're real 13–16 digit numbers from Meta's targeting search). When you don't have verified interest IDs, use broad geo-only targeting: `{"geo_locations":{"countries":["US"]}}` — which is also what Advantage+ Audience prefers. Age (`age_min`/`age_max`) is treated as a *suggestion* under Advantage+ Audience unless you hard-cap it.
- **Budget** (`daily_budget`/`lifetime_budget`) only if the parent is ABO. Under a CBO parent these are rejected.
- **`bid_strategy`** + `bid_amount`/`bid_constraints` only under ABO (bidding is campaign-level under CBO).
- **`destination_type`** required for messaging/profile/call goals (e.g. `WHATSAPP`, `MESSENGER`, `INSTAGRAM_DIRECT`, `FACEBOOK_PAGE`).
- **DSA** (`dsa_beneficiary`/`dsa_payor`) required when targeting EU countries.

### `ads_create_ad`
Creates a paused ad under an ad set. Required: `ad_account_id`, `ad_set_id`, `ad_name`. Plus a creative source in `creative` (JSON) — exactly one of:
- `creative_id` — reuse an existing creative entity;
- `object_story_id` — promote an existing post (`"pageID_postID"`);
- `object_story_spec` — inline creative; **must** contain `page_id` plus one of `link_data` / `video_data` / `photo_data` / `template_data`. Omitting `page_id` triggers a "Facebook Page is Missing" rejection.
Prefer `image_hash` (from `ads_get_ad_images`) over `image_url` inside `link_data`. Alternatively pass `source_ad_id` to duplicate an existing ad's creative.

### `ads_create_creative`
Creates a standalone reusable ad creative on the account. Because ads are immutable, this is how you make a changed creative before making a new ad.

### `ads_update_entity`
Edits an existing campaign / ad set / ad. `entity_type` = `campaign` | `ad_set` | `ad`, plus `entity_id` and `fields` (JSON of **Ads-API field names**, which differ from the create-tool argument names). Critical name differences: a campaign rename is `name` (not `campaign_name`); campaign budget is `daily_budget` / `lifetime_budget` (not `campaign_daily_budget`). Budgets are integers in minor units. **Cannot** edit creative content (immutable), cannot reparent, cannot change objective to a legacy value. Pausing an entity is an update: `fields: {"status":"PAUSED"}`.

### `ads_activate_entity`
Flips an entity from PAUSED to ACTIVE — **this publishes and starts spend.** `entity_type` = `campaign` | `ad_set` | `ad`. Activating a parent does **not** activate its children; for delivery, every level must be ACTIVE. Activate top-down: campaign → ad set → ad. Only call after explicit user confirmation. A `PUBLISHING` response for a draft means validation passed and the publisher is finishing — report as in-progress, not live. Validation errors list the offending objects; fix with `ads_update_entity` and retry (or `ignore_validation_errors=true` to publish the rest).

### Audiences
- `ads_create_custom_audience` / `ads_get_custom_audience` / `ads_get_ad_account_custom_audiences` / `ads_update_custom_audience` — website/engagement/customer-list audiences and lookalikes.
- `ads_update_custom_audience_users` — add/remove users in a customer-list (data-file) audience.
- `ads_get_custom_audience_adsets` — which ad sets use an audience (**check this before deleting**).
- `ads_delete_custom_audience` — permanent; delete child lookalikes first; ad sets using it get auto-paused.

### Creative upload
- `ads_creative_upload_media` — preferred uploader, for local files or public URLs (`upload_source` = `LOCAL_FILE` | `URL`; for URL set `media_type` IMAGE/VIDEO and `media_url`). Returns an `image_hash` / video ID to reference in a creative.
- `ads_creative_upload_image` / `ads_creative_upload_video` — older dedicated uploaders (still available).
- `ads_creative_update` / `ads_creative_delete` — edit/delete a creative entity.
- `ads_boost_ig_post` — turn an existing Instagram post into an ad.

---

## GROUP E — Pixel / dataset event management

For setting up and verifying conversion tracking (needs `ads_management` or `business_management`). Read → create → verify → activate.

- `ads_pixel_event_read` / `ads_pixel_event_create` / `ads_pixel_event_update` / `ads_pixel_event_delete` — conversion event *rules* on a pixel. `update` is status-only (ACTIVE/INACTIVE), batch-capable.
- `ads_pixel_parameter_read` / `_create` / `_update` / `_delete` — parameter extractors (CSS-selector or constant-value) that pull data (e.g. purchase value) into events.

The discipline: after creating and activating a new event, **verify it actually fires** (via Events Manager Test Events, Pixel Helper, or a network listener for the `/tr` beacon) before trusting conversion data. A conversion campaign optimizing on an event that doesn't fire will burn budget learning nothing.

---

## GROUP F — Catalog / dynamic ads (e-commerce only)

Only relevant if the account runs catalog/Advantage+ catalog (dynamic product) ads. Large group (~50 tools). Key ones:

- **Health/diagnostics (audit these first for catalog accounts):** `ads_catalog_get_diagnostics` (catalog-wide must-fix issues), `ads_catalog_get_dynamic_ads_health` (DA integration health per catalog/product set), `ads_catalog_event_source_get_health` (pixel↔catalog match rate).
- **Read:** `ads_catalog_list_catalogs`, `ads_catalog_list_products`, `ads_catalog_list_product_sets`, `ads_catalog_list_product_feeds`, `ads_catalog_get_data_sources`, `ads_catalog_list_partner_integrations`.
- **Write:** `ads_catalog_create`, `ads_catalog_create_product_feed`, `ads_catalog_create_product_set`, `ads_catalog_product_create`, `ads_catalog_update_product`, plus feed-rule and event-source connect/disconnect tools.

For a catalog account, poor delivery often traces to feed staleness or product-set coverage, not targeting/creative — rule that out with the health tools before touching bids or audiences.

---

## GROUP G — Experiments (measurement)

- `ads_experiment_check_eligibility` — can this account run a lift study?
- `ads_experiment_lift_create_test` / `ads_experiment_lift_get_test` — **conversion lift** studies (measure true incremental effect vs a holdout — the gold standard for "did the ads actually cause sales?").
- `ads_experiment_abtest_create_test` / `ads_experiment_abtest_get_test` / `ads_experiment_abtest_update_test` — A/B split tests (compare two setups head-to-head on a clean split).
- `ads_experiment_list_tests` — all studies on the account.

Use A/B tests to settle "which creative/audience/setup wins" cleanly instead of eyeballing overlapping ad sets. Use lift studies when the question is incrementality, not just reported ROAS.

---

## Quick map: task → tool

| The user wants… | Reach for |
|---|---|
| "How's my account doing?" | `ads_get_ad_entities` (account + campaign level) → `ads_insights_performance_trend` |
| "What's my best / worst ad?" | `ads_get_ad_entities` level=ad, sort ascending & descending |
| "Why did performance drop?" | `ads_insights_anomaly_signal` + `ads_account_get_activity_logs` |
| "Why isn't this delivering?" | `ads_get_errors` (blocking) → `ads_insights_auction_ranking_benchmarks` (overlap/auction) |
| "What should I change?" | `ads_get_opportunity_score` |
| "Is this good vs competitors?" | `ads_insights_industry_benchmark` |
| "Make a campaign" | `ads_create_campaign` → `_ad_set` → `_ad` → (confirm) → `ads_activate_entity` |
| "Change budget / pause" | `ads_update_entity` |
| "Fix my tracking" | dataset/pixel reads → `ads_pixel_event_*` → verify |
