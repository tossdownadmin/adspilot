# AdPilot AI — Prototype Planning Repository

AdPilot AI is a proposed standalone application that lets a user connect business data and advertising accounts, describe a business goal in natural language, and use an AI agent to plan and safely execute advertising campaigns.

This repository contains a working **local, read-only Meta Ads prototype**. After OAuth and explicit account selection, Overview, Live Audit, Live Intelligence, and Live Campaigns all use provider-returned data from that account. Test fixtures remain in automated tests only and are not used as a connected runtime fallback.

## Product thesis

Advertising platforms optimize delivery inside their own ecosystems. AdPilot AI sits above those systems and coordinates business context, creative strategy, budgets, platform tools, and human approvals. The LLM supplies reasoning; MCP or direct API adapters supply tools; deterministic application code enforces permissions and safety.

## Implemented prototype

The current live prototype demonstrates:

1. Connecting Meta through OAuth and selecting one real ad account.
2. Reading up to 1,000 campaigns over a fixed 60-day window.
3. Showing live spend, outcomes, ROAS, frequency, opportunity score, and delivery issues.
4. Normalizing localized Meta recommendation and error text into clear English while preserving raw provider evidence.
5. Running deterministic significance gates and campaign tiers on live account metrics.
6. Building closest-best and overall-best playbook references from live winners.
7. Keeping every Meta tool call read-only.
8. Running an account-scoped LLM agent through AdPilot's own API, with server-owned tools over the live Meta audit.

Campaign Intelligence uses deterministic cohort scoring, name-based JTD inference, closest-best/overall-best retrieval, field provenance, and validated JSON output. Missing provider metrics produce `Not enough data`; they never trigger fixture substitution.

The Connections screen supports local OAuth, encrypted temporary server sessions, live account discovery, and a fixed reporting-tool allowlist. It remains inactive until the Meta app secret is configured locally.

Real advertising spend is intentionally excluded from the first prototype. Browser state is persisted locally for easy demonstrations.

## Run locally

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Enable the local Meta connection

1. Copy `.env.example` to `.env.local`.
2. Open the new Meta developer app's **App settings → Basic** screen.
3. Add only the app secret to `META_APP_SECRET` in `.env.local`. Never paste it into chat or a browser form.
4. In Facebook Login for Business, add this valid OAuth redirect URI:

```text
http://localhost:3000/api/meta/callback
```

5. Restart `npm run dev`, open **Connections**, and choose **Connect Meta**.

The local encrypted session survives development-server reloads. It is still a prototype mechanism; durable server-side credential storage is required before deployment.

### Enable the AdPilot agent API

1. Create an OpenAI API key in your OpenAI developer account.
2. Add it only to `OPENAI_API_KEY` in `.env.local`.
3. Set `OPENAI_MODEL` to a model available to that API project; the example uses `gpt-5`.
4. Restart the local server.

With Meta connected, call AdPilot's own endpoint—not Meta directly:

```bash
curl -X POST http://localhost:3000/api/agent/run \
  -H "Content-Type: application/json" \
  -b "adpilot_meta_session=<your browser session cookie>" \
  -d '{"accountId":"720643091975703","prompt":"Audit the past 60 days and identify the strongest sales campaigns."}'
```

The browser session cookie is intentionally HttpOnly. For normal use, call this endpoint from the signed-in AdPilot UI or add proper application authentication before exposing it to external clients. See [Agent API V1](docs/AGENT_API_V1.md).

## Verify

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Demonstration flow

1. Open **Meta connection** and connect Meta.
2. Select the exact ad account to inspect.
3. Open **Live audit** for account recommendations and delivery issues.
4. Open **Live intelligence** for objective-aware deterministic scoring.
5. Open a campaign to inspect its score anatomy and provider-derived metrics.
6. Select **New playbook** to retrieve live historical references.
7. Open **Live campaigns** to search all returned campaign rows.

## Documentation index

- [Product scope](docs/PRODUCT_SCOPE.md)
- [User experience and flows](docs/USER_FLOWS.md)
- [System architecture](docs/ARCHITECTURE.md)
- [Agent and MCP design](docs/AGENT_AND_MCP.md)
- [Meta Ads MCP live connection V1](docs/META_ADS_MCP_LIVE_V1.md)
- [Live data surfaces V1](docs/LIVE_DATA_SURFACES_V1.md)
- [Campaign-building logic](docs/CAMPAIGN_BUILDING_LOGIC.md)
- [Campaign Intelligence V1](docs/CAMPAIGN_INTELLIGENCE_V1.md)
- [Historical audit and scoring V1](docs/AUDIT_SCORING_V1.md)
- [JTD, retrieval, and synthesis V1](docs/JTD_AND_RETRIEVAL_V1.md)
- [Playbook schema V1](docs/INTELLIGENCE_PLAYBOOK_SCHEMA_V1.md)
- [Intelligence simulation V1](docs/INTELLIGENCE_SIMULATION_V1.md)
- [Campaign Intelligence open decisions](docs/INTELLIGENCE_OPEN_DECISIONS.md)
- [Data model](docs/DATA_MODEL.md)
- [Agent API V1](docs/AGENT_API_V1.md)
- [API contract](docs/API_CONTRACT.md)
- [Safety, security, and compliance](docs/SAFETY_AND_SECURITY.md)
- [Testing and evaluation](docs/TESTING_AND_EVALS.md)
- [Delivery plan](docs/DELIVERY_PLAN.md)
- [Open decisions](docs/OPEN_DECISIONS.md)

## Current boundary

The runtime is read-only. It can discover accounts, retrieve reporting evidence, and run an LLM through its constrained internal tools, but it cannot call campaign creation, activation, update, audience-mutation, or budget-mutation tools. Durable credential storage, production authentication, public deployment, and real execution remain future phases and require separate approval.
