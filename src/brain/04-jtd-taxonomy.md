# Jobs-To-Be-Done (JTD) Taxonomy

Owns the set of "what is this campaign actually trying to do" labels. JTD is half of the cohort key (`objective:jtd`), so it determines which campaigns are compared against each other and which historical winners a new build can learn from. Getting JTD right is what makes "closest-best" retrieval meaningful.

Values below are the current nine IDs. The LLM proposes a JTD for each historical campaign (from its name and settings) and the user confirms low-confidence cases; the user confirms the JTD for any new brief. The engine never invents a JTD — an unclear one is `unknown`.

## The nine jobs

- **acquire_new** — bring in brand-new customers (broad prospecting).
- **first_order** — convert a known-but-never-purchased audience into their first order.
- **reactivate_lapsed** — win back customers who've gone quiet.
- **promote_lto** — push a limited-time offer / seasonal promo.
- **drive_catering** — drive catering / large-order / group inquiries.
- **lift_aov** — raise average order value (bundles, upsells, minimums).
- **new_location_awareness** — announce a new store/location to its local area.
- **loyalty_signup** — grow the loyalty / rewards / sign-up base.
- **unknown** — JTD couldn't be determined with confidence; excluded from being a reference.

## Name-inference hints (for the LLM's suggestion, never authoritative)

These are cues, not rules — the model suggests, the human confirms:

- "welcome", "new customer", "prospecting" → acquire_new
- "first order", "1st order", "new buyer" → first_order
- "win back", "we miss you", "lapsed", "reactivat" → reactivate_lapsed
- "LTO", "limited time", "deal", "% off", "weekend special" → promote_lto
- "catering", "party", "bulk", "group order" → drive_catering
- "bundle", "combo", "add-on", "upsize", "min spend" → lift_aov
- "now open", "grand opening", "new location", city/branch names → new_location_awareness
- "loyalty", "rewards", "sign up", "members" → loyalty_signup

Low confidence (no clear cue) → `unknown`, and flag for user confirmation.

## Extension slots (restaurant/food-tech — decide before adding)

Your open decisions raise three restaurant-specific candidates. They're **not** active yet; adding them re-shapes cohorts, so version the taxonomy when you do. Reserved candidate IDs: `promote_delivery` (own-channel vs aggregator push), `daypart_demand` (timed offer for a soft daypart), `franchise_local_push` (per-branch local activation). If you add any, backfill JTD on existing campaigns so cohorts don't fracture.

## Canonical config

```json
{
  "version": "1.0",
  "jobs": [
    { "id": "acquire_new", "label": "Acquire New", "referenceEligible": true },
    { "id": "first_order", "label": "First Order", "referenceEligible": true },
    { "id": "reactivate_lapsed", "label": "Reactivate Lapsed", "referenceEligible": true },
    { "id": "promote_lto", "label": "Promote LTO", "referenceEligible": true },
    { "id": "drive_catering", "label": "Drive Catering", "referenceEligible": true },
    { "id": "lift_aov", "label": "Lift AOV", "referenceEligible": true },
    { "id": "new_location_awareness", "label": "New Location Awareness", "referenceEligible": true },
    { "id": "loyalty_signup", "label": "Loyalty Signup", "referenceEligible": true },
    { "id": "unknown", "label": "Unknown", "referenceEligible": false }
  ],
  "extensionCandidates": ["promote_delivery", "daypart_demand", "franchise_local_push"]
}
```
