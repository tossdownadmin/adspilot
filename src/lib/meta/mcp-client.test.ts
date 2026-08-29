import { afterEach, describe, expect, it, vi } from "vitest";
import { assertMetaReadTool, callMetaReadTool, parseMcpResponse } from "./mcp-client";

describe("Meta Ads MCP read boundary", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("allows documented read tools", () => {
    expect(() => assertMetaReadTool("ads_get_ad_entities")).not.toThrow();
    expect(() => assertMetaReadTool("ads_get_errors")).not.toThrow();
  });

  it("rejects write tools locally", () => {
    expect(() => assertMetaReadTool("ads_create_campaign")).toThrow(/read-only mode/);
    expect(() => assertMetaReadTool("ads_activate_entity")).toThrow(/read-only mode/);
  });

  it("parses JSON and event-stream responses", () => {
    expect(parseMcpResponse("application/json", '{"result":{"ok":true}}')).toEqual({ result: { ok: true } });
    expect(parseMcpResponse("text/event-stream", 'event: message\ndata: {"result":{"ok":true}}\n\n')).toEqual({ result: { ok: true } });
  });

  it("attaches Meta MCP trace context without exposing the access token in the payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: { ok: true } }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await callMetaReadTool("server-only-token", "ads_get_ad_accounts", {}, { clientConversationId: "audit-123", advertiserRequest: "Run fixed audit" });

    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const payload = JSON.parse(String(options.body)) as { params: { arguments: Record<string, unknown> } };
    expect(payload.params.arguments).toMatchObject({ client_conversation_id: "audit-123", advertiser_request: "Run fixed audit" });
    expect(JSON.stringify(payload)).not.toContain("server-only-token");
  });
});
