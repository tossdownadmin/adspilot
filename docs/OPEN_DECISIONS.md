# Open Decisions and Assumptions

This file is the main review checklist. Implementation should begin after the required decisions are accepted or changed.

## 1. Decisions requiring product-owner review

### D1 — First advertising platform

**Recommendation:** Model the first adapter after Meta Ads and use a simulator in the prototype.

Alternatives: Google Ads first, TikTok first, or a generic platform with no Meta-specific fields.

### D2 — Prototype execution boundary

**Recommendation:** Simulated launch only, always resulting in a paused campaign.

Alternative: connect a real sandbox/test account. This introduces platform credentials, permissions, and external reliability into the first build.

### D3 — Agent availability

**Recommendation:** Include deterministic demo mode plus an optional LLM mode configured through an environment variable.

Alternative: require an LLM API key for every run.

### D4 — LLM provider strategy

**Recommendation:** Define a provider-neutral planner interface and implement one provider first after the owner chooses it.

Choices may include OpenAI, Anthropic, or another structured-output-capable provider.

### D5 — Interaction model

**Recommendation:** Guided form plus optional natural-language instructions, followed by a structured review screen.

Alternative: chat-first interface. A chat-only interface is less precise for money, dates, and approvals.

### D6 — Authentication

**Recommendation:** Seed one local prototype user and design tables for future authentication.

Alternative: implement full email/social authentication in the prototype.

### D7 — Persistence

**Recommendation:** Use PostgreSQL-compatible models with a simple local development setup.

Decision needed: local PostgreSQL from day one versus SQLite locally and PostgreSQL before deployment.

### D8 — Visual direction

**Recommendation:** Professional operator dashboard: calm neutral base, clear status colors, dense enough for campaign review, and no chatbot-style novelty aesthetic.

Decision needed: brand name, logo, preferred colors, and any reference products.

### D9 — Deployment

**Recommendation:** Finish and verify local prototype first, then choose hosting.

Decision needed before deployment: preferred provider and whether a public demo is required.

## 2. Working assumptions

- One user, one workspace, and one simulated ad account are enough for the prototype.
- The user understands that simulated results are not performance predictions.
- English is the initial interface and generated-copy language.
- USD is the default currency but the domain model supports ISO currencies.
- Sales, leads, and traffic are the supported objectives.
- Campaign creation is the initial action; optimization is deferred.
- Creative output consists of copy and creative direction, not generated media assets.
- Product context is entered by the user; automatic website crawling is deferred.

## 3. Suggested acceptance response

The product owner can approve quickly by responding with either:

> Approved as proposed. Proceed with the prototype.

or listing changes by decision identifier, for example:

> D4: use OpenAI first. D7: use PostgreSQL from day one. D8: call it AdPilot and use a dark interface.

## 4. Consequences of approval

Approval authorizes implementation of the documented simulated prototype only. It does not authorize:

- Connecting or modifying a real ad account.
- Spending advertising funds.
- Deploying publicly.
- Purchasing services.
- Requesting production platform permissions.

