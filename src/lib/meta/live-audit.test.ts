import { afterEach, describe, expect, it, vi } from "vitest";
import { runLiveMetaAudit } from "./live-audit";

type ToolRequest = { params: { name: string; arguments: Record<string, unknown> } };

function toolRequest(init?: RequestInit) {
  return JSON.parse(String(init?.body)) as ToolRequest;
}

function metaResponse(result: unknown, status = 200) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", result: { structuredContent: result } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("live Meta audit orchestration", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps campaign data when field verification fails and scopes errors to top campaign ids", async () => {
    const requests: ToolRequest[] = [];
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      const request = toolRequest(init);
      requests.push(request);
      if (request.params.name === "ads_get_field_context") return new Response("unavailable", { status: 503 });
      if (request.params.name === "ads_get_ad_entities") return metaResponse({ data: [
        { id: "cmp-low", name: "Lower spend", objective: "OUTCOME_SALES", amount_spent: "20" },
        { id: "cmp-top", name: "Top spend", objective: "OUTCOME_SALES", amount_spent: "123.45", impressions: "5000", ctr: "2.5", cpc: "1.2", cpm: "8.4" },
      ] });
      if (request.params.name === "ads_get_opportunity_score") return metaResponse({ opportunity_score: 82, recommendations: [{ title: "Use more placements" }] });
      if (request.params.name === "ads_insights_performance_trend") return metaResponse({ series: [{ metric: "ROAS", direction: "UP" }] });
      if (request.params.name === "ads_get_errors") return metaResponse({ errors: [] });
      throw new Error(`Unexpected tool: ${request.params.name}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const audit = await runLiveMetaAudit("token", "720643091975703");

    expect(audit.campaigns.status).toBe("ok");
    if (audit.campaigns.status === "ok") expect(audit.campaigns.data[0]?.id).toBe("cmp-top");
    expect(audit.advisories[0]).toContain("Field metadata verification was unavailable");
    const errorsRequest = requests.find((request) => request.params.name === "ads_get_errors");
    expect(errorsRequest?.params.arguments.entity_ids).toEqual(["cmp-top", "cmp-low"]);
    expect(errorsRequest?.params.arguments.entity_ids).not.toContain("720643091975703");
    const trendRequest = requests.find((request) => request.params.name === "ads_insights_performance_trend");
    expect(trendRequest?.params.arguments).not.toHaveProperty("analysis_metric");
    expect(trendRequest?.params.arguments).not.toHaveProperty("time_range");
    expect(audit.opportunity.status).toBe("ok");
    if (audit.opportunity.status === "ok") expect(audit.opportunity.data.score).toBe(82);
  });

  it("decodes Meta string payloads, formatted metrics, and nested delivery errors", async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      const { params } = toolRequest(init);
      if (params.name === "ads_get_field_context") return metaResponse({ fields: [{ name: "id" }], unknown_fields: [] });
      if (params.name === "ads_get_ad_entities") return metaResponse({ ad_entities: JSON.stringify([
        { id: "cmp-1", name: "Corporate", objective: "OUTCOME_SALES", amount_spent: "$4,573.63 USD", impressions: "1,145,786", ctr: "0.29%", cpc: "$1.36 USD", cpm: "$3.99 USD" },
      ]) });
      if (params.name === "ads_get_opportunity_score") return metaResponse({ score: 0, recommendations: [] });
      if (params.name === "ads_insights_performance_trend") return metaResponse({ result: "No performance trend data available for the given criteria." });
      if (params.name === "ads_get_errors") return metaResponse({ errors: JSON.stringify([
        { id: "cmp-1", errors: [], children: [{ id: "ad-1", errors: [{ error_message: "Invalid post/page ID" }], children: [] }] },
      ]) });
      throw new Error(`Unexpected tool: ${params.name}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const audit = await runLiveMetaAudit("token", "720643091975703");

    expect(audit.campaigns.status).toBe("ok");
    if (audit.campaigns.status === "ok") {
      expect(audit.campaigns.data).toHaveLength(1);
      expect(audit.campaigns.data[0]?.spend).toBe(4573.63);
      expect(audit.campaigns.data[0]?.impressions).toBe(1145786);
      expect(audit.campaigns.data[0]?.ctr).toBe(0.29);
    }
    expect(audit.errors.status).toBe("ok");
    if (audit.errors.status === "ok") {
      expect(audit.errors.data.count).toBe(1);
      expect(audit.errors.data.items[0]).toMatchObject({ error_message: "Invalid post/page ID" });
    }
  });

  it("does not call errors with an account id when no campaigns are returned", async () => {
    const requests: ToolRequest[] = [];
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      const request = toolRequest(init);
      requests.push(request);
      if (request.params.name === "ads_get_ad_entities") return metaResponse({ data: [] });
      return metaResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    const audit = await runLiveMetaAudit("token", "720643091975703");

    expect(requests.some((request) => request.params.name === "ads_get_errors")).toBe(false);
    expect(audit.errors).toEqual({ status: "unavailable", message: "Delivery issues are unavailable because Meta returned no campaign IDs for this audit." });
  });

  it("passes the user's actual agent request into Meta context", async () => {
    const requests: ToolRequest[] = [];
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      const request = toolRequest(init);
      requests.push(request);
      if (request.params.name === "ads_get_ad_entities") return metaResponse({ data: [] });
      return metaResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    await runLiveMetaAudit("token", "720643091975703", "Show me which sales campaigns are strongest.");

    expect(requests.every((request) => request.params.arguments.advertiser_request === "Show me which sales campaigns are strongest.")).toBe(true);
  });
});
