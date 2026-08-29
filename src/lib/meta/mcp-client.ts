import { getMetaConfig } from "./config";

export const META_READ_TOOLS = [
  "ads_get_ad_accounts",
  "ads_get_field_context",
  "ads_get_ad_entities",
  "ads_get_opportunity_score",
  "ads_get_errors",
  "ads_insights_advertiser_context",
  "ads_insights_anomaly_signal",
  "ads_insights_auction_ranking_benchmarks",
  "ads_insights_industry_benchmark",
  "ads_insights_performance_trend",
] as const;

export type MetaReadTool = (typeof META_READ_TOOLS)[number];

export type MetaAdAccount = {
  id: string;
  name: string;
  status?: string;
  currency?: string;
  timezone?: string;
  isMcpEnabled?: boolean;
  isQueryable?: boolean;
};

type JsonRpcResponse = {
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
};

export type MetaToolDefinition = {
  name: MetaReadTool;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

export type MetaRequestContext = {
  clientConversationId: string;
  advertiserRequest: string;
};

export class MetaMcpError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "MetaMcpError";
  }
}

export function assertMetaReadTool(tool: string): asserts tool is MetaReadTool {
  if (!(META_READ_TOOLS as readonly string[]).includes(tool)) {
    throw new MetaMcpError(`Meta MCP tool is not available in read-only mode: ${tool}`);
  }
}

export function parseMcpResponse(contentType: string, body: string): JsonRpcResponse {
  if (!contentType.includes("text/event-stream")) return JSON.parse(body) as JsonRpcResponse;

  const data = body
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== "[DONE]")
    .at(-1);

  if (!data) throw new MetaMcpError("Meta MCP returned an empty event stream.");
  return JSON.parse(data) as JsonRpcResponse;
}

export async function callMetaReadTool(
  accessToken: string,
  tool: MetaReadTool,
  args: Record<string, unknown>,
  context?: MetaRequestContext,
) {
  assertMetaReadTool(tool);
  const config = getMetaConfig();
  const response = await fetch(config.mcpServerUrl, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: {
        name: tool,
        arguments: {
          ...args,
          ...(context ? {
            client_conversation_id: context.clientConversationId,
            advertiser_request: context.advertiserRequest,
          } : {}),
        },
      },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new MetaMcpError(
      response.status === 401 ? "Meta authentication has expired." : "Meta Ads MCP is unavailable.",
      response.status,
    );
  }

  const payload = parseMcpResponse(response.headers.get("content-type") || "application/json", raw);
  if (payload.error) throw new MetaMcpError(payload.error.message || "Meta Ads MCP returned an error.");
  return payload.result;
}

export function unwrapMetaToolResult(result: unknown): unknown {
  if (!result || typeof result !== "object") return result;
  const envelope = result as { structuredContent?: unknown; content?: unknown };
  if (envelope.structuredContent !== undefined) return envelope.structuredContent;
  if (!Array.isArray(envelope.content)) return result;

  const textItems = envelope.content
    .map((item) => (item && typeof item === "object" ? (item as { text?: unknown }).text : undefined))
    .filter((text): text is string => typeof text === "string" && text.length > 0);

  for (const text of textItems) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      // Keep looking for structured JSON before falling back to text.
    }
  }
  return textItems.length === 1 ? { text: textItems[0] } : { text: textItems.join("\n") };
}

export async function listMetaReadToolDefinitions(accessToken: string): Promise<MetaToolDefinition[]> {
  const config = getMetaConfig();
  const response = await fetch(config.mcpServerUrl, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method: "tools/list" }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const raw = await response.text();
  if (!response.ok) throw new MetaMcpError("Meta Ads MCP capabilities are unavailable.", response.status);
  const payload = parseMcpResponse(response.headers.get("content-type") || "application/json", raw);
  if (payload.error) throw new MetaMcpError(payload.error.message || "Meta Ads MCP returned an error.");

  const result = payload.result as { tools?: Array<{ name?: string; description?: string; inputSchema?: Record<string, unknown> }> } | undefined;
  return (result?.tools ?? [])
    .filter((tool): tool is { name: MetaReadTool; description?: string; inputSchema?: Record<string, unknown> } => {
      return typeof tool.name === "string" && (META_READ_TOOLS as readonly string[]).includes(tool.name);
    })
    .map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema }));
}

export async function listMetaAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
  const result = await callMetaReadTool(accessToken, "ads_get_ad_accounts", {});
  const rows = findAccountRows(unwrapMetaToolResult(result));
  return rows
    .map(normalizeAccount)
    .filter((account): account is MetaAdAccount => Boolean(account?.id));
}

function findAccountRows(value: unknown): unknown[] {
  return findArray(value);
}

function findArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  for (const key of ["data", "accounts", "ad_accounts", "adAccounts", "items", "results"]) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [];
}

function normalizeAccount(value: unknown): MetaAdAccount | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  const rawId = row.id ?? row.account_id ?? row.ad_account_id;
  if (typeof rawId !== "string" && typeof rawId !== "number") return undefined;
  const id = String(rawId).replace(/^act_/, "");
  return {
    id,
    name: stringValue(row.name ?? row.ad_account_name) || `Ad account ${id}`,
    status: stringValue(row.status ?? row.account_status),
    currency: stringValue(row.currency),
    timezone: stringValue(row.timezone ?? row.timezone_name),
    isMcpEnabled: booleanValue(row.is_ads_mcp_enabled),
    isQueryable: booleanValue(row.is_queryable),
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}

function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}
