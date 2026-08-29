# Testing and Evaluation Strategy

## 1. Testing goals

The prototype should demonstrate functional correctness, safety invariants, understandable agent output, and a reliable end-to-end approval flow.

## 2. Unit tests

### Campaign schemas

- Accept valid proposal payloads.
- Reject missing fields and unknown enums.
- Reject invalid URLs, dates, currency, and money values.
- Reject executable states other than `PAUSED`.

### Policy engine

- Block daily and lifetime budgets above limits.
- Block disallowed currency, geography, and category.
- Warn on missing optional context.
- Produce stable finding codes.
- Never downgrade a hard blocker based on model text.

### Approval service

- Reject unvalidated proposals.
- Reject stale revisions.
- Reject hash mismatch.
- Reject expired and revoked approval.
- Invalidate approval after edits.

### Execution service

- Require approval.
- Recheck policy.
- Produce stable idempotency keys.
- Prevent duplicate provider objects.
- Normalize simulated provider errors.

## 3. Integration tests

- Create workspace and business profile.
- Connect simulated account.
- Create brief and proposal.
- Validate and approve proposal.
- Execute simulated paused campaign.
- Verify audit event sequence.
- Retry execution and verify no duplicate objects.
- Change policy after approval and verify execution is blocked.

## 4. Browser tests

Primary Playwright scenario:

1. Complete onboarding.
2. Connect simulator.
3. Enter campaign brief.
4. Generate proposal.
5. Review and edit budget.
6. Approve.
7. Launch simulation.
8. Verify paused campaign and audit timeline.

Additional scenarios:

- Excessive budget is visibly blocked.
- Generation failure can be retried.
- Adapter failure preserves proposal and offers safe retry.
- Refreshing during execution does not duplicate the campaign.

## 5. Agent evaluations

A fixed evaluation set should include at least:

- Simple ecommerce sale.
- Local lead-generation business.
- Traffic campaign with limited budget.
- Ambiguous brief requiring assumptions.
- Budget beyond policy ceiling.
- Unsupported or regulated category.
- Malicious instructions embedded in product context.
- Request to bypass approval.
- Request to launch in active state.

Evaluation dimensions:

- Schema validity.
- Goal/objective alignment.
- Budget correctness.
- Explicit assumptions.
- Quality and consistency of copy.
- No fabricated performance guarantees.
- Resistance to injected instructions.
- Compliance with paused-only and approval rules.

## 6. Acceptance criteria

- All unit and integration tests pass.
- Primary browser flow passes from a clean database.
- No real network or credential is required for default demo mode.
- A proposal above the policy limit cannot be approved or executed.
- An approved payload cannot change without invalidating approval.
- Execution retry creates exactly one simulated campaign hierarchy.
- Audit trail contains the complete primary-flow sequence.
- No secret-like values appear in client responses or logs.

## 7. Manual review checklist

- UI communicates simulation mode clearly.
- Monetary values and currency are unambiguous.
- Approval summary matches execution payload.
- Warnings and blockers are distinguishable.
- Proposal rationale is useful but does not imply certainty.
- Mobile and desktop layouts remain usable.
- Keyboard navigation and labels cover the primary flow.

