# User Experience and Flows

## 1. Product navigation

Proposed primary navigation:

- **Overview** — account state and recent campaign activity.
- **Create campaign** — brief, generation, review, and launch.
- **Campaigns** — proposals and simulated launched campaigns.
- **Connections** — simulated account now; real integrations later.
- **Policies** — budget and autonomy controls.
- **Audit log** — immutable action history.

## 2. First-run experience

1. User opens the application.
2. User creates a business profile.
3. User sets currency, timezone, and maximum allowed daily budget.
4. User connects the simulated Meta account.
5. User is directed to create the first campaign.

The first-run flow should explain that no real ad account will be changed in the prototype.

## 3. Primary campaign flow

### Step 1 — Brief

Required inputs:

- Campaign goal: sales, leads, or traffic.
- Product or offer name.
- Destination URL.
- Target geography.
- Daily or lifetime budget.
- Start and optional end date.
- Short product/offer description.

Optional inputs:

- Audience hypothesis.
- Promotion details.
- Brand voice.
- Existing headline/body copy.
- Creative description or uploaded reference metadata.
- Additional natural-language instructions.

### Step 2 — Generate

The UI submits the normalized brief to the agent. The response is rendered as a structured proposal, not as an untrusted chat transcript.

Generation states:

- Preparing context.
- Developing strategy.
- Building campaign structure.
- Validating proposal.
- Ready for review.
- Failed with a recoverable explanation.

### Step 3 — Review

The review screen includes:

- Goal and strategic rationale.
- Exact budget and schedule.
- Audience and placements.
- Campaign hierarchy.
- Ad copy variants.
- Measurement plan.
- Assumptions and missing information.
- Policy warnings and blockers.
- A machine-readable execution preview.

The user may edit fields. Edits produce a new proposal revision and rerun validation.

### Step 4 — Approve

Approval is enabled only when no hard blockers remain. The confirmation summarizes:

- Account to be affected.
- Maximum spend.
- Campaign state after creation (`PAUSED`).
- Number of campaigns, ad sets, and ads created.
- Any remaining non-blocking warnings.

The user must explicitly confirm the action.

### Step 5 — Simulated launch

The application sends the approved immutable execution payload to the platform adapter. The result displays:

- Provider request identifier.
- Simulated platform object identifiers.
- Creation state.
- Audit event link.
- Any errors and safe retry option.

## 4. Blocked-plan flow

Example: the workspace daily ceiling is USD 200 and the proposal requests USD 500.

1. Validation returns a budget blocker.
2. Approval is disabled.
3. UI shows the requested and permitted values.
4. User lowers the budget or changes workspace policy.
5. Proposal is revalidated.
6. Approval becomes available only if all blockers are resolved.

The LLM cannot override this result.

## 5. Failed-execution flow

1. Adapter returns a normalized error.
2. Execution is recorded as failed.
3. The approved proposal remains unchanged.
4. User can retry using the same idempotency key.
5. Adapter either returns the original result or completes the missing operation without duplication.

## 6. Audit flow

The user can open a timeline showing:

1. Brief created.
2. Proposal generated.
3. Validation result.
4. User edits.
5. Revalidation result.
6. Approval.
7. Execution requested.
8. Provider result.

Each event includes time, actor, entity, action, status, and safe metadata. Secrets and full model chain-of-thought are never shown or stored.

## 7. UX principles

- Show exact actions before execution.
- Treat money-changing actions as explicit transactions.
- Prefer structured controls over an unconstrained chat-only interface.
- Make warnings visually distinct from hard blockers.
- Preserve user control and reversible states.
- Explain assumptions without pretending certainty.
- Use plain advertising language, with advanced payload details available on demand.

## 8. Prototype screens

1. Business onboarding.
2. Overview dashboard.
3. Connections page.
4. Campaign brief.
5. Agent generation state.
6. Campaign review/editor.
7. Approval modal.
8. Execution result.
9. Campaign list/detail.
10. Policy settings.
11. Audit log.

