# API Contract

## 1. Conventions

- Base path: `/api/v1`.
- JSON request and response bodies.
- UUID resource identifiers.
- ISO 8601 timestamps.
- Integer minor units for money.
- Stable machine-readable error codes.
- Request IDs returned in every response.
- Idempotency key required for external mutation endpoints.

## 2. Response envelope

Successful response:

```json
{
  "data": {},
  "requestId": "req_..."
}
```

Error response:

```json
{
  "error": {
    "code": "PROPOSAL_VALIDATION_BLOCKED",
    "message": "The proposal exceeds the workspace daily budget limit.",
    "fieldErrors": []
  },
  "requestId": "req_..."
}
```

## 3. Workspace and setup

### `GET /api/v1/workspace`

Returns the active prototype workspace, business profile, and policy summary.

### `PUT /api/v1/workspace/business-profile`

Creates or updates business context.

### `PUT /api/v1/workspace/policy`

Updates budget and execution controls. Must create an audit event.

## 4. Connections

### `GET /api/v1/connections`

Lists configured provider connections.

### `POST /api/v1/connections/meta-simulator`

Creates the simulated Meta connection and seeded ad account.

### `GET /api/v1/ad-accounts`

Lists accounts visible through connected providers.

### Local Meta OAuth scaffold

The live prototype additionally exposes server route handlers outside the future `/api/v1` resource API:

- `GET /api/meta/status` — safe server configuration, session state, and discovered accounts.
- `GET /api/meta/connect` — starts Facebook Login for Business OAuth.
- `GET /api/meta/callback` — validates OAuth state and creates a temporary server session.
- `POST /api/meta/disconnect` — deletes the temporary session.
- `POST /api/meta/audit` — runs the fixed 60-day read-only reporting plan for one selected account.

These routes never return access tokens, app secrets, or authorization headers. See `META_ADS_MCP_LIVE_V1.md`.

## 5. Campaign briefs

### `POST /api/v1/campaign-briefs`

Creates a validated campaign brief.

### `GET /api/v1/campaign-briefs/:briefId`

Returns the brief and its proposal revisions.

### `PATCH /api/v1/campaign-briefs/:briefId`

Updates an unapproved brief. Changes after a proposal exists require a new proposal generation.

## 6. Proposal generation and editing

### `POST /api/v1/campaign-briefs/:briefId/proposals`

Generates a new proposal revision using the configured planner.

Response status may be:

- `READY_FOR_APPROVAL`
- `VALIDATION_BLOCKED`
- `GENERATION_FAILED`

### `GET /api/v1/proposals/:proposalId`

Returns proposal payload, validation findings, revision metadata, and approval eligibility.

### `POST /api/v1/proposals/:proposalId/revisions`

Creates a new revision from allowed user edits. The server normalizes and validates the complete resulting proposal.

### `POST /api/v1/proposals/:proposalId/validate`

Runs policy and provider-capability validation without mutation.

## 7. Approval and execution

### `POST /api/v1/proposals/:proposalId/approvals`

Approves the exact current proposal hash. Rejects blocked, stale, or superseded proposals.

Example request:

```json
{
  "proposalPayloadHash": "sha256:...",
  "confirmation": true
}
```

### `POST /api/v1/approvals/:approvalId/executions`

Creates a simulated paused campaign.

Required header:

```text
Idempotency-Key: <client-generated UUID>
```

### `GET /api/v1/executions/:executionId`

Returns execution status, normalized results, created object IDs, and safe error details.

## 8. Campaigns and audit

### `GET /api/v1/campaigns`

Lists proposal and simulated provider states.

### `GET /api/v1/campaigns/:campaignId`

Returns campaign structure, execution history, and linked audit events.

### `GET /api/v1/audit-events`

Supports pagination and filters by entity, action, actor, status, and date.

## 9. Error codes

Initial stable codes:

- `AUTHENTICATION_REQUIRED`
- `FORBIDDEN`
- `RESOURCE_NOT_FOUND`
- `INVALID_REQUEST`
- `CONNECTION_UNAVAILABLE`
- `GENERATION_FAILED`
- `MODEL_OUTPUT_INVALID`
- `PROPOSAL_VALIDATION_BLOCKED`
- `PROPOSAL_SUPERSEDED`
- `APPROVAL_REQUIRED`
- `APPROVAL_EXPIRED`
- `APPROVAL_HASH_MISMATCH`
- `EXECUTION_ALREADY_IN_PROGRESS`
- `PROVIDER_VALIDATION_FAILED`
- `PROVIDER_RATE_LIMITED`
- `PROVIDER_UNAVAILABLE`
- `EXECUTION_FAILED`

## 10. Deferred endpoints

The complete versioned reporting API, recommendations, budget changes, creative uploads, durable OAuth storage, and live write endpoints remain deferred. The local Meta OAuth scaffold is intentionally temporary and read-only.
