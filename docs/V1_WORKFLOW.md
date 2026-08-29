---
title: AdPilot V1 Workflow
status: active
---

# AdPilot V1 Workflow

## User journey

```mermaid
flowchart LR
  A[Connect Meta once with OAuth] --> B[See all accessible ad accounts]
  B --> C[Select one account]
  C --> D[Run fixed 60-day read-only audit]
  D --> E[Top campaigns and objective-aware scores]
  E --> F[Review top spend and proven references]
  F --> G[Define the new campaign JTBD]
  G --> H[Compare closest and overall reference]
  H --> J[Create a reviewable campaign playbook]
  J --> I[Human approval before any future write action]
```

## V1 promise

For one selected Meta account, AdPilot identifies the campaigns with enough evidence to learn from, explains their performance against the correct objective, and turns the selected pattern into a human-reviewable campaign playbook. It never publishes, pauses, or changes Meta objects in V1.

## Audit output

1. **Account snapshot**: account identity, currency, 60-day period, retrieval time, spend, opportunity score, and material delivery issues.
2. **Top campaigns**: sorted by live Meta spend and separately by deterministic, objective-aware score.
3. **Winner explorer**: filters and rollups for objective, region, product/offer, and creative format.
4. **New campaign brief**: user-confirmed JTBD, objective, region, product/offer, and budget. Inferences are suggestions only.
5. **Evidence detail**: score contributions, significance gates, raw metrics, and data-quality warnings.
6. **Playbook**: closest relevant winner, overall winner, configuration guidance, provenance, JSON/YAML export, and explicit human review requirement.

## What an account connection means

The Meta OAuth session can discover all accounts the connected user can access. The user then selects the specific account to audit. V1 does not combine several accounts because their currencies, markets, tracking, attribution, and recommendations may differ.

## Evidence labels

| Label | Meaning |
| --- | --- |
| Meta returned | Meta returned the field for the selected account. |
| Inferred from campaign name | A transparent naming rule gives a provisional grouping. |
| Not enough data | The required field was not returned; no substitute was invented. |

## V1 boundaries

- Read-only Meta MCP tools only.
- 60-day historical campaign audit.
- One selected account per audit.
- No dummy data in a connected experience.
- No automatic cold-start playbook or fabricated brief values.
- Raw LLM/MCP tool traces are not part of the primary user journey.
- Campaign creation remains a future, approval-gated phase.
