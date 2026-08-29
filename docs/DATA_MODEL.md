# Data Model

## 1. Modeling principles

- Use UUID identifiers internally.
- Scope all business entities to a workspace.
- Store money as integer minor units plus ISO currency.
- Store timestamps in UTC and preserve account timezone separately.
- Version agent proposals rather than overwriting them.
- Keep approvals immutable and tied to exact payload hashes.
- Append audit events; do not update historical events.

## 2. Core entities

### User

- `id`
- `email`
- `displayName`
- `createdAt`
- `updatedAt`

The prototype may seed one local user while retaining this shape.

### Workspace

- `id`
- `name`
- `ownerUserId`
- `currency`
- `timezone`
- `createdAt`
- `updatedAt`

### BusinessProfile

- `id`
- `workspaceId`
- `businessName`
- `websiteUrl`
- `category`
- `offerDescription`
- `brandVoice`
- `defaultGeographies[]`
- `createdAt`
- `updatedAt`

### WorkspacePolicy

- `id`
- `workspaceId`
- `maxDailyBudgetMinor`
- `maxLifetimeBudgetMinor`
- `allowedCurrencies[]`
- `allowedGeographies[]`
- `blockedCategories[]`
- `requireHumanApproval`
- `initialCampaignStatus`
- `version`
- `updatedAt`

### ProviderConnection

- `id`
- `workspaceId`
- `provider`
- `mode` (`SIMULATED` or future `LIVE`)
- `status`
- `scopes[]`
- `externalBusinessId`
- `tokenReference` (future encrypted secret reference, never raw client output)
- `expiresAt`
- `createdAt`
- `updatedAt`

### AdAccount

- `id`
- `workspaceId`
- `providerConnectionId`
- `provider`
- `externalAccountId`
- `name`
- `currency`
- `timezone`
- `status`
- `capabilities[]`
- `createdAt`
- `updatedAt`

### CampaignBrief

- `id`
- `workspaceId`
- `adAccountId`
- `createdByUserId`
- `goal`
- `productName`
- `offerDescription`
- `destinationUrl`
- `geographies[]`
- `budgetType`
- `budgetMinor`
- `startAt`
- `endAt`
- `audienceHint`
- `creativeContext`
- `additionalInstructions`
- `status`
- `createdAt`
- `updatedAt`

### CampaignProposal

- `id`
- `workspaceId`
- `campaignBriefId`
- `revision`
- `schemaVersion`
- `plannerType`
- `modelIdentifier` (nullable for demo planner)
- `structuredPayload`
- `payloadHash`
- `status`
- `createdAt`

Unique constraint: `(campaignBriefId, revision)`.

### ValidationRun

- `id`
- `workspaceId`
- `campaignProposalId`
- `policyVersion`
- `status`
- `findings[]`
- `createdAt`

Each finding contains code, severity, field path, message, and safe metadata.

### Approval

- `id`
- `workspaceId`
- `campaignProposalId`
- `proposalPayloadHash`
- `approvedByUserId`
- `authorizedBudgetMinor`
- `currency`
- `expiresAt`
- `createdAt`
- `revokedAt`

Approvals are invalid if the proposal changes, policies become more restrictive, or the approval expires.

### Execution

- `id`
- `workspaceId`
- `approvalId`
- `adAccountId`
- `provider`
- `idempotencyKey`
- `status`
- `requestPayload`
- `normalizedResult`
- `providerRequestId`
- `errorCode`
- `errorMessage`
- `startedAt`
- `completedAt`

Unique constraint: `(provider, adAccountId, idempotencyKey)`.

### ExternalCampaignObject

- `id`
- `workspaceId`
- `executionId`
- `provider`
- `objectType`
- `externalObjectId`
- `parentExternalObjectId`
- `name`
- `status`
- `createdAt`

### AuditEvent

- `id`
- `workspaceId`
- `actorType`
- `actorId`
- `action`
- `entityType`
- `entityId`
- `status`
- `metadata`
- `requestId`
- `createdAt`

## 3. Important invariants

- A proposal belongs to the same workspace and ad account as its brief.
- A proposal revision is immutable after persistence.
- Only the latest valid revision can be approved.
- An approval references exactly one proposal payload hash.
- An execution cannot begin without a valid approval.
- A prototype execution always requests `PAUSED` status.
- Retrying an execution with the same idempotency key cannot create duplicates.
- Audit metadata must not contain access tokens or secrets.

## 4. Retention proposal

For the prototype, retain local records until the workspace is reset. Before a live deployment, define explicit retention and deletion policies for:

- Model prompts and responses.
- Provider request/response payloads.
- Audit events.
- OAuth credentials.
- Uploaded creative assets.
- User and workspace deletion requests.

