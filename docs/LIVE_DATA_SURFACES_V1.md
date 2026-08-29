# Live Data Surfaces V1

## Decision

When Meta is connected, the selected ad account is the single source of truth across the AdPilot runtime. No screen may present a demo company, fabricated campaign, or seed metric as if it belongs to that account.

## Surface contract

| Surface | Live source | Allowed local data |
| --- | --- | --- |
| Connections | Meta account discovery | Selected account ID |
| Live audit | Meta campaign reporting, opportunity score, errors, trend | Retrieval state |
| Intelligence | Meta campaign performance normalized into deterministic tiers | User-entered JTD corrections and filters |
| Campaigns | Meta campaign entities for the selected account | UI filters |
| Campaign builder | Live winner evidence plus user brief | Unpublished draft and human approval |
| Overview | Selected account and latest live audit summary | Last retrieval timestamp |
| Policies | User-authored safety rules | Policy configuration |
| Audit log | Actual application actions | Append-only local prototype events |

## Account-scope rule

One OAuth connection discovers all ad accounts available to the authenticated Meta user. The user explicitly picks the account for the current audit; no account is silently selected and no data is blended across accounts. This makes a live result explainable and avoids mixing currencies, regions, attribution settings, and account-level recommendations.

## Dimension-evidence rule

Region, product/offer, and creative-format views must identify their source:

- `Meta returned`: a provider field supports the value.
- `Inferred from name`: a deterministic naming rule supplies a provisional label.
- `Not enough data`: the provider did not return the required metadata.

An inferred label is useful for exploration but must not be described as an account fact or used to make a creative-format claim.

## Language normalization

Meta provider responses may be localized. The application:

1. Uses stable recommendation types and error patterns to create concise English labels.
2. Extracts numeric impact values without changing them.
3. Keeps raw provider text in Developer evidence.
4. Never presents a guessed translation as a provider fact.

## Empty and failure states

- Authentication missing: ask the user to reconnect.
- Account missing: return to account selection.
- Metric missing: show `Not enough data`.
- Provider section unavailable: keep successful sections and label the failed section.
- Never fall back to test fixtures in a connected runtime.
