# Significance Gates

Owns the "is there enough evidence to judge this campaign?" test. A campaign that fails **any** gate for its objective is marked `insufficient_data`, gets no score or tier, and can never become a reference for building new campaigns. This is the guardrail against reacting to noise (a "great" ROAS on 3 purchases is not evidence).

Values below are the current `significanceFailures()` values.

## The gates

- **sales** — spend ≥ 100, impressions ≥ 10,000, conversions ≥ 15, days active ≥ 5.
- **leads** — spend ≥ 100, impressions ≥ 5,000, conversions ≥ 15, days active ≥ 5.
- **traffic** — spend ≥ 50, impressions ≥ 5,000, landing-page views ≥ 100, days active ≥ 3.
- **awareness** — spend ≥ 50, reach ≥ 10,000, days active ≥ 3.

A failing gate emits a machine code (`min_spend_100`, `min_impressions_10000`, …) which surfaces to the user as the reason a campaign couldn't be scored. Keep the codes stable; the UI and tests depend on them.

## Currency & spend-tier hooks (important, mostly future)

The spend thresholds are **USD-shaped**. A `min_spend_100` gate means one thing on a US account spending thousands a day and something very different on a Lahore account where a whole campaign might spend PKR 100/day. Two consequences:

- Keep `defaultCurrency: "USD"` and the current numbers as the default so existing tests pass.
- The loader should support a `currencyOverrides` map so an account's gates can be swapped for its currency without editing the defaults. It's empty now; populate it per-account when you go multi-account. Impression/reach/conversion/day gates are currency-independent and stay as-is.

Do **not** change the default numbers to "fix" this now — that would break the current test suite. Add the override mechanism and leave defaults intact.

## Canonical config

```json
{
  "defaultCurrency": "USD",
  "gates": {
    "sales":     { "minSpend": 100, "minImpressions": 10000, "minConversions": 15, "minDaysActive": 5 },
    "leads":     { "minSpend": 100, "minImpressions": 5000,  "minConversions": 15, "minDaysActive": 5 },
    "traffic":   { "minSpend": 50,  "minImpressions": 5000,  "minLandingPageViews": 100, "minDaysActive": 3 },
    "awareness": { "minSpend": 50,  "minReach": 10000, "minDaysActive": 3 }
  },
  "currencyOverrides": {}
}
```
