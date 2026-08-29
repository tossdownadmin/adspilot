# Delivery Plan

> Status: the local simulated prototype described by Milestones 1–5 has been implemented as a client-persisted demonstration. Production database, authentication, live LLM, and live provider work remain deferred.

## 1. Delivery approach

Implementation is divided into reviewable milestones. Each milestone should end with a runnable state, tests proportional to its risk, and no dependency on later milestones.

## 2. Milestone 0 — Scope approval

Deliverables:

- Product scope.
- User flows.
- Architecture and agent/MCP boundary.
- Data and API contracts.
- Safety controls.
- Testing plan.
- Resolved decisions in `OPEN_DECISIONS.md`.

Exit condition: product owner approves the prototype boundary and key technical choices.

## 3. Milestone 1 — Application foundation

Deliverables:

- Next.js/TypeScript project.
- UI system and responsive shell.
- Database schema and migrations.
- Seeded local user/workspace.
- Business onboarding and policy settings.
- Simulated connection page.

Verification:

- Application starts locally.
- Schema migration and seed are repeatable.
- Unit checks, type checking, and linting pass.

## 4. Milestone 2 — Campaign briefing and proposal

Deliverables:

- Campaign brief form and validation.
- Versioned campaign proposal schema.
- Deterministic demo planner.
- Optional LLM planner interface.
- Proposal persistence and revision history.
- Proposal review UI.

Verification:

- A brief reliably generates a schema-valid proposal offline.
- Invalid model output fails safely.
- Proposal revisions are immutable.

## 5. Milestone 3 — Safety and approval

Deliverables:

- Policy engine.
- Findings UI for warnings and blockers.
- Editable proposal fields with revalidation.
- Approval transaction with payload hashing and expiration.
- Audit events for the complete flow.

Verification:

- Budget violations cannot be approved.
- Edits invalidate prior approval.
- Policy changes are enforced before execution.

## 6. Milestone 4 — Simulated execution

Deliverables:

- Provider adapter interface.
- Simulated Meta adapter.
- Idempotent execution orchestrator.
- Configurable failure simulation.
- Campaign result and audit timeline UI.

Verification:

- Approved proposals create paused simulated objects.
- Retries do not duplicate objects.
- Failures are normalized and recoverable.

## 7. Milestone 5 — Product polish and handoff

Deliverables:

- Dashboard and campaign list.
- Empty, loading, error, and success states.
- End-to-end test suite.
- Agent evaluation fixtures.
- Local setup documentation.
- Demonstration script.

Exit condition: all acceptance criteria in `TESTING_AND_EVALS.md` pass.

## 8. Recommended implementation sequence

1. Resolve open decisions.
2. Scaffold and establish data model.
3. Build the primary UX with fixtures.
4. Implement domain schemas and policy engine.
5. Add persistence and revision history.
6. Add demo and optional LLM planners.
7. Add approval and audit services.
8. Add simulated adapter and execution.
9. Complete automated and manual verification.

## 9. Definition of done for the prototype

- A new developer can run it from documented setup instructions.
- The complete happy path works without external credentials.
- Optional LLM mode can be enabled by configuration.
- No real advertising platform is mutated.
- Core safety invariants have automated tests.
- Architecture leaves a clear seam for a real Meta adapter or MCP tool provider.
- Limitations and next steps are documented honestly.

## 10. Deferred production work

- Production identity and multi-tenancy.
- Live OAuth and encrypted credential lifecycle.
- Durable queues and distributed locking.
- Production observability and incident response.
- Provider app review.
- Legal/privacy/compliance review.
- Billing and usage metering.
- Live reporting and optimization.

## 11. Proposed Campaign Intelligence V1 phase

This phase begins only after review of the Campaign Intelligence documentation pack.

1. Build the versioned historical simulation dataset.
2. Implement normalization and objective-specific significance gates.
3. Implement JTD suggestion/review fixtures.
4. Implement deterministic cohorts, scoring, and explanations.
5. Implement closest-best/overall-best retrieval.
6. Implement playbook synthesis, provenance, and JSON/YAML export.
7. Validate failure and cold-start scenarios.
8. Connect the existing read-only Meta data source after simulation acceptance.

## 12. Meta Ads MCP live-read increment

Status: implemented and verified against a user-selected live ad account.

1. Register the dedicated Meta app and Ads MCP use case.
2. Add safe environment configuration and status reporting.
3. Implement OAuth state validation and temporary server sessions.
4. Implement the read-only Meta Ads MCP client and account discovery.
5. Add a distinct live connection experience to Connections.
6. Verify the missing-config, OAuth-error, connected, and disconnected states.
7. Add the fixed 60-day audit adapter after connection acceptance.
8. Normalize Meta's string-encoded campaign and error payloads into typed UI evidence.
9. Add an explicit handoff from the live audit to the simulated intelligence and campaign-building labs.

The increment remains read-only. Live campaign mutation, automated winner scoring from provider data, and production credential storage remain deferred.

## 13. Live-data-only correction

Status: implemented and verified against the selected live account.

1. Normalize localized Meta recommendations and delivery issues into English display copy while preserving raw evidence.
2. Replace the Campaign Intelligence runtime fixture with the selected account's live campaign evidence.
3. Remove demo account and simulated-data claims from connected product surfaces.
4. Carry the selected account into Overview, Live Campaigns, and live playbook context.
5. Keep all Meta actions read-only until the separate write-path safety review.
