# Safety, Security, and Compliance

## 1. Threat model

The system eventually controls financial spend and third-party business assets. Important risks include:

- Unauthorized account access.
- Excessive or accidental spend.
- Prompt injection through external content.
- Model hallucination or malformed execution data.
- Duplicate campaigns caused by retries.
- Cross-workspace data leakage.
- Secret exposure in logs or model context.
- Misleading, prohibited, or regulated advertising.
- Compromised provider credentials.
- Stale approvals applied to changed proposals.

## 2. Prototype safety boundary

The prototype uses a simulated advertising adapter and cannot spend real money. It must still implement the architecture of approval, validation, idempotency, and auditing so these are not retrofitted later.

## 3. Mandatory controls

### Human approval

- Every launch requires explicit approval.
- Approval is tied to one immutable proposal hash.
- Any edit invalidates approval.
- Approval expires.

### Budget controls

- Workspace daily and lifetime ceilings.
- Currency must match account and policy.
- No negative, zero, malformed, or overflow values.
- Execution cannot authorize more than the approved amount.

### Execution controls

- Campaigns are created paused.
- Every execution has an idempotency key.
- Policy is checked again immediately before execution.
- Provider identifiers and results are persisted before retry.
- A global kill switch will be required before live integration.

### Credential controls

- Tokens remain on the server.
- Tokens are encrypted at rest in a live deployment.
- Model prompts never contain raw tokens.
- Logs redact secrets and authorization headers.
- Provider permissions use least privilege.

### Tenant isolation

- All queries are scoped to workspace identity.
- Resource IDs alone never grant access.
- Cross-workspace references fail closed.

## 4. Prompt-injection defense

- Treat websites, product feeds, analytics labels, uploads, and tool responses as untrusted data.
- Delimit untrusted content clearly in agent input.
- Never allow retrieved content to redefine system policy or tool authorization.
- Restrict tool parameters with schemas and server-side authorization.
- Keep mutating tools unavailable during pure proposal generation.
- Validate every model-produced URL, amount, enum, date, and identifier.

## 5. Advertising policy posture

The prototype will not claim to perform complete regulatory or provider policy clearance. It will:

- Block configured unsupported categories.
- Flag potentially sensitive or regulated claims.
- Require the user to confirm factual claims and rights to creative assets.
- Avoid generating guaranteed outcomes or fabricated testimonials.
- Preserve the final approved copy for audit.

Before a live release, platform-specific policies and relevant local advertising, privacy, political-ad, credit, employment, housing, health, alcohol, gambling, and age-targeting requirements need legal and compliance review.

## 6. Privacy

The prototype should avoid personal audience data. Future live versions must define:

- Legal basis and purpose limitation.
- Data-processing agreements.
- User access and deletion workflows.
- Retention periods.
- Regional storage requirements.
- Rules for customer lists, pixels, conversion APIs, and sensitive attributes.

## 7. Audit requirements

Audit events record:

- Who initiated the action.
- What entity and revision were affected.
- What authorization was used.
- Whether policy allowed or blocked it.
- What provider operation occurred.
- The safe result and request correlation ID.

Audit events must exclude secrets, raw credentials, and private model reasoning.

## 8. Live-integration readiness gate

Real campaign creation must remain disabled until all of the following exist:

- Reviewed OAuth implementation.
- Encrypted token storage and rotation.
- Provider app approval and correct scopes.
- Durable idempotency and jobs.
- Rate-limit and retry handling.
- Production authentication and authorization.
- Monitoring and kill switch.
- Tested budget ceilings.
- Incident response and credential revocation procedures.
- Legal and privacy review appropriate to target markets.

## 9. Local Meta Ads MCP exception

The local V1 may connect a developer-owned Meta app and account for read-only validation before the full live-execution gate is satisfied. This exception does not permit campaign creation, activation, updates, audience mutation, or budget changes.

Controls for this phase:

- Temporary AES-GCM encrypted local token sessions only.
- HttpOnly encrypted session cookie; no raw token in browser storage.
- OAuth state verification.
- Fixed read-only MCP tool allowlist.
- No generic MCP proxy endpoint.
- No provider payload or credential passed to an LLM without normalization.
- Development-mode testing with app-role users and explicitly selected accounts.
