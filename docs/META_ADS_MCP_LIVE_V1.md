# Meta Ads MCP Live Connection V1

## 1. Decision

AdPilot will connect to Meta's first-party Ads MCP server as a standalone MCP client. Claude, ChatGPT, or another hosted chat product is not part of the runtime path.

```text
AdPilot browser
  -> AdPilot server OAuth/session boundary
  -> AdPilot read-only MCP client
  -> https://mcp.facebook.com/ads
  -> one user-selected Meta ad account
  -> Campaign Intelligence deterministic engine
```

The Meta developer app ID used for the local prototype is `2478727052619848`. An app ID is an identifier, not a credential. The app secret and user access tokens must never be committed, rendered in the browser, logged, or passed to an LLM.

## 2. V1 objective

The first live flow proves that a user can:

1. Start Meta OAuth from the Connections screen.
2. Return to AdPilot with a server-side session.
3. List the Meta ad accounts the user can access.
4. Explicitly select one account.
5. Run a 60-day read-only audit for the selected account.
6. Review top-spending campaigns, opportunity score, delivery errors, and recent performance movement.
7. Preserve the provider evidence needed by Campaign Intelligence without presenting simulated rows as live data.

## 3. Meta configuration

The Meta app must include the `Create & manage ads with ads MCP server` use case. For private testing, its permissions may remain `Ready for testing` and the app may remain in Development mode.

The local Facebook Login for Business redirect URI is:

```text
http://localhost:3000/api/meta/callback
```

Expected server-only environment variables:

```text
META_APP_ID=2478727052619848
META_APP_SECRET=<local secret, never commit>
META_REDIRECT_URI=http://localhost:3000/api/meta/callback
META_GRAPH_API_VERSION=v26.0
META_MCP_SERVER_URL=https://mcp.facebook.com/ads
```

`META_APP_SECRET` is entered only in `.env.local` on the machine running AdPilot. It is not sent through chat or a client-side form.

## 4. Authentication flow

1. `GET /api/meta/connect` creates a cryptographically random OAuth state value.
2. The state is stored in a short-lived, HttpOnly, SameSite=Lax cookie.
3. The user authenticates in Facebook Login for Business.
4. Meta returns an authorization code to `GET /api/meta/callback`.
5. AdPilot verifies state and exchanges the code for a user access token on the server.
6. The token is encrypted with AES-GCM using a key derived from the server-only app secret and stored in an HttpOnly session cookie.
7. The browser is redirected to `/` with the Connections view selected.

The local encrypted cookie survives development-server reloads but is not a production credential store. Durable server-side encrypted token storage, rotation, revocation, and multi-user isolation are required before deployment.

## 5. Permission posture

Meta's Ads MCP use case exposes several permissions, including management permissions. AdPilot V1 applies a narrower application-level policy.

Allowed MCP tools:

- `ads_get_ad_accounts`
- `ads_get_field_context`
- `ads_get_ad_entities`
- `ads_get_opportunity_score`
- `ads_get_errors`
- `ads_insights_advertiser_context`
- `ads_insights_anomaly_signal`
- `ads_insights_auction_ranking_benchmarks`
- `ads_insights_industry_benchmark`
- `ads_insights_performance_trend`

For every tool call, AdPilot supplies a generated `client_conversation_id` and an `advertiser_request` describing the fixed audit action. This creates a useful audit trail without giving the browser control over tool names or arbitrary provider arguments.

Explicitly unavailable in V1:

- Every `ads_create_*` tool.
- `ads_activate_entity`.
- `ads_update_entity`.
- Audience, catalog, dataset, experiment, and budget mutations.
- Any generic tool-call endpoint accepting a client-supplied tool name.

The server owns the allowlist. The browser and the LLM cannot expand it.

## 6. MCP transport

AdPilot calls `https://mcp.facebook.com/ads` using JSON-RPC over Streamable HTTP and sends the Meta user access token in the server-side `Authorization: Bearer` header.

The transport implementation must:

- Accept JSON and server-sent-event responses.
- Normalize JSON-RPC errors without returning authorization headers or tokens.
- Use request timeouts.
- Refuse tools outside the allowlist before any network request.
- Keep raw provider payloads out of model prompts until normalized and bounded.

## 7. Connection states

The Connections UI exposes these states:

- `CONFIGURATION_REQUIRED`: app secret or callback configuration is missing.
- `READY_TO_CONNECT`: server configuration is complete; no user session exists.
- `CONNECTED`: a valid local session exists and account discovery succeeded.
- `AUTHENTICATION_EXPIRED`: the provider rejected the token.
- `PROVIDER_UNAVAILABLE`: Meta could not be reached or returned an unusable response.

Connected state must be derived from the server. The existing simulated connection flag in browser local storage is not authoritative for Meta.

## 8. API surface

### `GET /api/meta/status`

Returns safe configuration and session state. It never returns secrets or tokens.

### `GET /api/meta/connect`

Starts OAuth. Fails closed when required server configuration is missing.

### `GET /api/meta/callback`

Verifies state, exchanges the authorization code, creates the temporary server session, and redirects to Connections.

### `POST /api/meta/disconnect`

Deletes the temporary server session and clears its HttpOnly cookie.

### `POST /api/meta/audit`

Accepts one explicitly selected ad account ID and runs a fixed read-only audit plan. The browser cannot supply an MCP tool name or arbitrary tool arguments.

The audit orchestrator may call:

- `ads_get_ad_entities` for campaign, ad-set, and ad reporting over the previous 60 days.
- `ads_get_opportunity_score` for Meta's current account recommendations.
- `ads_get_errors` for material delivery blockers.
- `ads_insights_performance_trend` for recent metric movement when supported for the account.

The endpoint returns one normalized `LiveMetaAudit` envelope with provider evidence, per-section availability, safe errors, and timestamps. A failure in one optional section does not erase successful campaign reporting.

## 9. Account selection

Account discovery uses `ads_get_ad_accounts`. The UI displays only provider-returned account name, ID, status, currency, and timezone. Selection is explicit; AdPilot does not silently choose the first account.

The selected account ID may be stored in browser state because it is an identifier, but it does not grant access. Every live request rechecks the authenticated server session.

When many accounts are available, the selector must default to a compact searchable control. After selection, one primary action labelled `Run 60-day audit` moves the user directly into the live audit surface.

One connection can list all accessible accounts. V1 audits one explicitly selected account at a time; it does not aggregate several accounts into a portfolio result.

## 10. Live audit presentation

The live audit is visually distinct from the historical fixture simulator:

- Persistent `LIVE META DATA` badge.
- Selected account ID and currency.
- Explicit 60-day window and retrieval timestamp.
- Loading steps for campaigns, recommendations, errors, and trends.
- `Not enough data` or `Unavailable` states instead of fabricated metrics.
- Provider values shown only when returned by Meta.
- A raw-evidence disclosure for debugging without tokens or headers.

Meta may localize recommendation and error text using the authenticating user's Meta language. The main product UI must normalize supported recommendation types and known delivery issues into clear English. The exact provider wording is preserved only in Developer evidence. Unknown localized text must be labelled as untranslated provider evidence rather than silently guessed.

The live-to-engine adapter supplies Campaign Intelligence from the same selected account. Missing purchase, revenue, or conversion metrics must reduce scoring coverage and appear as `Not enough data`; fixtures are never used as a runtime fallback.

The audit’s region, product, and creative-format explorer preserves the source of each dimension. Campaign names may provide provisional region/product labels. Creative format is only shown as confirmed when ad-level provider metadata was returned; otherwise it remains unavailable.

## 11. Acceptance checks

- The app runs normally without `.env.local` and explains which configuration is missing.
- The Meta app ID can be shown; the app secret and access token never appear in API responses or rendered HTML.
- OAuth state mismatch fails safely.
- The callback cannot create a session without a valid code exchange.
- A valid session can list accounts.
- A selected account can run the fixed 60-day reporting plan.
- Partial provider failures appear at section level without invented fallback metrics.
- A non-allowlisted MCP tool is rejected locally.
- Disconnect clears both the server session and cookie.
- Simulator and live Meta states are visually distinct.
- No live write tool is callable from the V1 application.

## 12. Deferred before deployment

- Durable encrypted credential storage.
- Token refresh, rotation, revocation, and deletion workflows.
- Production HTTPS callback URL.
- Production authentication and workspace isolation.
- Meta App Review and Advanced Access for users outside app roles or external businesses.
- Rate-limit backoff, durable jobs, observability, and incident response.
- Legal, privacy, and data-retention review.
