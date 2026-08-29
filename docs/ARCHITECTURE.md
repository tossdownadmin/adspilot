# System Architecture

## 1. Architecture principles

- The LLM proposes; deterministic code authorizes.
- Credentials remain server-side and are scoped per provider and account.
- Provider differences are hidden behind a typed adapter interface.
- Every external mutation is idempotent and auditable.
- Proposal generation and campaign execution are separate operations.
- The prototype works without real advertising credentials.

## 2. Proposed technology stack

The initial recommendation is:

- **Application:** Next.js with TypeScript.
- **UI:** React, Tailwind CSS, and accessible component primitives.
- **Server:** Next.js route handlers/server actions for the prototype.
- **Database:** PostgreSQL in production; SQLite-compatible local persistence is acceptable during early prototyping if the ORM supports migration.
- **ORM:** Prisma or Drizzle; final choice remains open.
- **Validation:** Zod schemas shared between UI, server, agent output, and adapters.
- **LLM integration:** Provider-neutral interface supporting structured output/tool calling.
- **Jobs:** In-process queue for simulation, replaceable by a durable worker before live integrations.
- **Testing:** Vitest for units/integration and Playwright for the primary browser flow.

## 3. Component view

```text
Browser
  |
  v
Next.js application
  |-- Authentication boundary (prototype identity)
  |-- Campaign brief service
  |-- Proposal service
  |     |-- LLM provider interface
  |     |-- Campaign schema parser
  |     `-- Validation/policy engine
  |-- Approval service
  |-- Execution orchestrator
  |     `-- Ad platform adapter interface
  |             `-- Simulated Meta adapter
  |-- Audit service
  `-- Database
```

## 4. Core modules

### 4.1 Campaign domain

Owns campaign briefs, proposal schemas, revisions, statuses, and invariants. It must not depend on a specific LLM or advertising provider.

### 4.2 Agent service

Builds bounded context, requests a structured proposal, parses the response, and returns either a valid proposal or a typed generation error. It cannot approve or execute campaigns.

### 4.3 Policy engine

Pure deterministic functions evaluating a proposal against workspace policies and account constraints. Output consists of blockers, warnings, and informational findings.

### 4.4 Approval service

Creates an immutable approval record tied to the exact proposal revision and payload hash. It rejects stale, changed, invalid, or already superseded proposals.

### 4.5 Execution orchestrator

Verifies approval, derives an idempotency key, calls the provider adapter, records the result, and emits audit events.

### 4.6 Provider adapters

Implement a shared contract while translating normalized campaign concepts into provider-specific payloads and errors.

### 4.7 Audit service

Appends structured events. Audit records cannot be edited through normal product APIs.

## 5. Provider adapter contract

Conceptual interface:

```ts
interface AdPlatformAdapter {
  getConnectionStatus(): Promise<ConnectionStatus>;
  listAdAccounts(): Promise<AdAccount[]>;
  validateDraft(draft: CampaignExecutionDraft): Promise<ProviderValidation>;
  createPausedCampaign(
    draft: CampaignExecutionDraft,
    context: ExecutionContext,
  ): Promise<CampaignExecutionResult>;
  getCampaign(externalCampaignId: string): Promise<ExternalCampaign>;
}
```

The simulated adapter and a future Meta adapter implement the same interface.

## 6. State model

```text
DRAFT_BRIEF
  -> GENERATING
  -> PROPOSED
  -> VALIDATION_BLOCKED | READY_FOR_APPROVAL
  -> APPROVED
  -> EXECUTING
  -> LAUNCHED_PAUSED | EXECUTION_FAILED
```

Changes to a proposal after approval create a new revision and invalidate the prior approval.

## 7. Request lifecycle

### Proposal generation

1. Authenticate actor.
2. Load workspace, account metadata, policy, and brief.
3. Construct minimal agent context.
4. Request schema-constrained output.
5. Parse and normalize output.
6. Run deterministic validation.
7. Persist proposal revision and validation results.
8. Append audit event.

### Campaign execution

1. Authenticate actor.
2. Load approved proposal revision.
3. Recompute and verify payload hash.
4. Recheck policies and connection state.
5. Acquire idempotency lock.
6. Call `createPausedCampaign`.
7. Persist normalized and provider results.
8. Append audit events.
9. Return status to UI.

## 8. Configuration

Expected environment configuration after implementation:

- Database connection.
- Application base URL.
- Session/authentication secret.
- Optional LLM provider and model.
- Optional LLM API key.
- Feature flag for deterministic demo planner.
- Feature flag for simulated provider errors.
- Future Meta client ID, secret, and redirect URL.

No secrets belong in source control or client-visible environment variables.

## 9. Deployment assumption

The prototype should run locally with one command after setup and remain deployable to a conventional Node.js host. Live advertising integrations will require HTTPS, stable OAuth callback URLs, encrypted credential storage, and durable background jobs.

## 10. Campaign Intelligence V1 extension

Campaign Intelligence adds a read-only analysis path ahead of proposal generation:

```text
Meta read adapter
  -> normalized campaign snapshots
  -> JTD classification and review
  -> deterministic significance/cohort/scoring engine
  -> versioned winner library
  -> closest-best and overall-best retrieval
  -> grounded recommendation synthesis
  -> validated JSON/YAML playbook
```

Authoritative metrics, scores, tiers, retrieval candidates, provenance, and confidence components are calculated or validated outside the LLM. See `CAMPAIGN_INTELLIGENCE_V1.md` for the product flow and `AUDIT_SCORING_V1.md` for scoring rules.

## 11. Meta Ads MCP live read path

The first live provider uses Meta's first-party Ads MCP server rather than recreating each Marketing API endpoint:

```text
Browser -> OAuth route -> temporary server session
                         -> read-only MCP client
                         -> Meta Ads MCP
                         -> normalized account and reporting data
```

The MCP transport is an implementation detail behind the provider boundary. Application code exposes named, bounded operations and never a generic user-selectable tool executor. The browser receives account metadata and normalized results, never access tokens.

See `META_ADS_MCP_LIVE_V1.md` for the authentication, allowlist, session, and testing contract.
