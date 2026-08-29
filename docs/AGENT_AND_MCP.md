# Agent and MCP Design

## 1. Responsibility split

MCP does not supply intelligence by itself. The proposed system separates responsibilities:

- **LLM agent:** interprets goals, combines context, proposes strategy, and selects permitted tools.
- **MCP or direct API tools:** expose structured capabilities and data.
- **Ad-platform algorithms:** optimize auction delivery within a platform.
- **Policy engine:** enforces non-negotiable application rules.
- **Human approver:** authorizes spending actions in the prototype and early product phases.

## 2. Prototype agent mode

The prototype should support two planner implementations:

1. **Demo planner:** deterministic, requires no external model credentials, and produces a realistic proposal from the brief.
2. **LLM planner:** optional provider-backed structured generation when an API key is configured.

Both return the same `CampaignProposal` schema. This makes the full application testable without a network connection or paid model access.

## 3. Why MCP remains useful

MCP provides a reusable boundary between the agent runtime and external capabilities. A standalone application can be an MCP client; it does not need to run inside Claude or another model vendor's UI.

Future tools may be provided by:

- Third-party MCP servers.
- First-party AdPilot MCP servers.
- Internal tools wrapping direct platform APIs.
- Non-MCP functions registered directly with the agent runtime.

The domain layer should not care which transport supplies a tool.

For the first live Meta connection, AdPilot is the MCP client and Meta hosts the Ads MCP server at `https://mcp.facebook.com/ads`. This is independent of Claude or any other model UI. The agent can only request application operations backed by a server-owned read-tool allowlist; it cannot name arbitrary MCP tools.

## 4. Proposed tools

### Read-only planning tools

- `get_business_profile`
- `get_ad_account_summary`
- `get_workspace_policy`
- `get_product_context`
- `get_historical_performance` (future)
- `get_inventory_status` (future)

The live Meta V1 maps bounded application operations to Meta tools such as `ads_get_ad_accounts`, `ads_get_ad_entities`, `ads_get_opportunity_score`, `ads_get_errors`, and performance-trend tools. Meta write tools are not registered with the V1 agent.

### Drafting tools

- `validate_campaign_draft`
- `estimate_campaign_structure`
- `save_campaign_proposal`

### Mutating tools

- `create_paused_campaign`
- `pause_campaign`
- `request_budget_change`
- `apply_approved_budget_change`

Mutating tools require server-issued authorization context. The agent cannot manufacture approval identifiers.

## 5. Agent workflow for the prototype

1. Receive a normalized brief and bounded workspace context.
2. Identify missing facts and record explicit assumptions.
3. Select a supported objective.
4. Design a simple campaign structure.
5. Generate multiple copy variants and creative direction.
6. Produce a measurement plan.
7. Return a schema-conforming proposal.
8. Submit it to deterministic validation.
9. If blocked, explain what the user must change; do not attempt execution.

The agent is not allowed to launch the campaign during this workflow.

## 6. Proposal schema outline

```text
CampaignProposal
  schemaVersion
  summary
  rationale
  assumptions[]
  risks[]
  campaign
    name
    objective
    buyingType
    status
  adSets[]
    name
    audience
    placements
    optimizationGoal
    budget
    schedule
    ads[]
      name
      destinationUrl
      headline
      primaryText
      description
      callToAction
      creativeBrief
  measurement
    primaryMetric
    secondaryMetrics[]
    trackingRequirements[]
```

The exact TypeScript/Zod schema will be finalized during implementation.

## 7. Context rules

- Pass only data relevant to the current workspace and action.
- Never pass OAuth secrets or raw access tokens to the model.
- Clearly label user-supplied and externally retrieved content as untrusted.
- Do not treat instructions embedded in websites, files, or ad copy as system instructions.
- Store model inputs and outputs only according to configured retention policy.
- Store summaries and structured reasons, not private chain-of-thought.

## 8. Prompting principles

- Require strict structured output.
- State supported objectives and platform limitations.
- Require assumptions and risks to be explicit.
- Require `PAUSED` as the initial campaign status.
- Prohibit invented performance guarantees.
- Tell the model that policy validation and approval occur outside it.
- Reject extra fields and recover safely from malformed output.

## 9. Autonomy levels

Proposed future product levels:

- **Level 0 — Advise:** recommendations only.
- **Level 1 — Draft:** create executable drafts; user launches.
- **Level 2 — Approved actions:** agent executes individually approved actions.
- **Level 3 — Bounded autopilot:** reversible actions inside explicit limits.
- **Level 4 — Broad autonomy:** intentionally not planned without substantial evidence, controls, and compliance review.

The prototype operates at Level 1 with a simulated Level 2 execution after explicit approval.

## 10. Tool-call authorization

Every mutating call must include server-generated context:

- Workspace and actor identity.
- Approved proposal revision.
- Approval identifier.
- Payload hash.
- Idempotency key.
- Maximum authorized spend.
- Expiration time.

The execution service verifies these independently before calling an adapter.
