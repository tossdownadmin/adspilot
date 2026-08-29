# Product Scope

## 1. Working name

**AdPilot AI** is a placeholder name and can be changed before implementation.

## 2. Problem

Small teams often have business context spread across websites, analytics, commerce systems, creative libraries, and multiple advertising platforms. Each ad platform optimizes within its own silo. Users must translate business goals into campaign structures, targeting, budgets, and creative manually.

## 3. Product vision

Create a standalone AI media-buying workspace where a user can express a commercial goal, review the agent's reasoning and campaign plan, and authorize bounded actions across connected advertising platforms.

## 4. Target user

The prototype is designed for:

- A founder, growth marketer, or small agency operator.
- Someone familiar with basic advertising concepts but not necessarily platform APIs.
- A user managing one business and initially one Meta advertising account.
- A user who wants assistance and controlled automation, not an opaque autonomous trading system for ad spend.

Enterprise permissions, agency hierarchies, and multi-client billing are future concerns.

## 5. Core value proposition

The user can move from a natural-language business goal to an executable, policy-checked campaign draft without manually configuring every platform field.

## 6. Prototype goals

The prototype must prove that:

1. A user can provide enough context for an AI agent to form a coherent campaign strategy.
2. The agent can convert that strategy into a strict, machine-valid campaign specification.
3. Deterministic controls can stop unsafe or incomplete actions.
4. A human can understand, edit, approve, and trace the proposed action.
5. The platform integration boundary can later switch from simulation to a real API or MCP server.

## 7. MVP capabilities

### 7.1 Workspace setup

- Create a local prototype workspace.
- Enter business name, website, category, offer, target geography, currency, and default budget ceiling.
- Store a concise brand profile and optional brand voice.

### 7.2 Advertising account

- Display one simulated Meta advertising account connection.
- Store account name, platform, currency, timezone, connection status, and permissions.
- Make the adapter interface compatible with a future real Meta OAuth/API integration.

### 7.3 Campaign briefing

- Guided form for goal, product, audience, destination URL, budget, schedule, geography, and creative inputs.
- Optional free-text instruction for additional context.
- Validation before the brief reaches the agent.

### 7.4 AI campaign planning

- Produce one structured campaign proposal.
- Include objective, strategic rationale, campaign/ad-set/ad structure, audience, placements, budget, schedule, copy variants, creative direction, assumptions, risks, and expected measurement plan.
- Produce data conforming to a versioned schema.
- Never directly publish while generating a proposal.

### 7.5 Policy validation

- Enforce maximum daily and lifetime budgets.
- Ensure dates, currency, destination URL, geography, and required fields are valid.
- Block prohibited or unsupported categories configured by the prototype.
- Warn when the agent makes unsupported assumptions.
- Require explicit human approval before launch.

### 7.6 Review and approval

- Present the proposed strategy and exact execution payload.
- Clearly separate agent suggestions, warnings, and hard blockers.
- Allow the user to edit supported fields.
- Revalidate after every edit.
- Record approval identity, timestamp, proposal version, and payload hash.

### 7.7 Simulated launch

- Create a fake platform campaign through the adapter interface.
- Return stable simulated campaign, ad-set, and ad identifiers.
- Initially create the campaign in `PAUSED` state.
- Show execution events and any simulated platform errors.
- Support retry without creating duplicates.

### 7.8 Audit history

- Show proposal generation, validation, edits, approval, execution, and result.
- Preserve earlier proposal versions.
- Never silently rewrite an approved payload.

## 8. Explicitly out of scope for prototype

- Real OAuth credentials or real ad spend.
- Fully autonomous campaign activation.
- Automatic budget changes.
- Cross-platform budget allocation.
- Live analytics ingestion or attribution.
- Image or video generation.
- Website crawling beyond explicitly supplied content.
- Meta app review and production permissions.
- Google, TikTok, LinkedIn, or other live adapters.
- Billing, subscriptions, teams, roles, or agency tenancy.
- Claims that the system guarantees campaign performance.

## 9. Proposed post-prototype phases

### Phase 2 — Real Meta draft creation

- Meta OAuth and permission handling.
- Real account and asset discovery.
- Create campaigns in paused state.
- Real platform error normalization.

### Phase 3 — Reporting and recommendations

- Scheduled performance ingestion.
- Metric normalization.
- Agent-generated recommendations.
- Human-approved pause, bid, and budget changes.

### Phase 4 — Multi-platform coordination

- Google and TikTok adapters.
- Cross-platform performance view.
- Budget reallocation proposals subject to policy and approval.

### Phase 5 — Bounded autopilot

- User-configurable action policies.
- Small, reversible automatic changes within hard limits.
- Automatic rollback and anomaly detection.

## 10. Success criteria

The prototype is successful when a reviewer can complete the primary flow in under five minutes and:

- Understand what the agent proposes and why.
- See an invalid or excessive plan blocked.
- Edit and approve a valid plan.
- Observe a simulated paused campaign launch.
- Inspect a complete audit trail.
- Confirm that swapping the simulated adapter for a real provider does not require redesigning the agent.

## 11. Non-goals

- Replacing platform auction and delivery algorithms.
- Letting an LLM hold unrestricted platform credentials.
- Hiding execution details behind conversational output.
- Treating model-generated text as a policy or security boundary.

