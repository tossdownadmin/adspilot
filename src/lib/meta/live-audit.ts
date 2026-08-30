import { callMetaReadTool, type MetaReadTool, type MetaRequestContext, unwrapMetaToolResult } from "./mcp-client";

export type LiveAuditSection<T> =
  | { status: "ok"; data: T; raw: unknown }
  | { status: "unavailable"; message: string };

export type LiveCampaignRow = {
  id: string;
  campaignId?: string;
  adSetId?: string;
  name: string;
  objective?: string;
  status?: string;
  effectiveStatus?: string;
  spend?: number;
  impressions?: number;
  clicks?: number;
  reach?: number;
  ctr?: number;
  cpc?: number;
  cpm?: number;
  frequency?: number;
  results?: number;
  costPerResult?: number;
  landingPageViews?: number;
  purchases?: number;
  purchaseValue?: number;
  purchaseRoas?: number;
  dailyBudget?: number;
  createdTime?: string;
  startTime?: string;
  stopTime?: string;
  creativeFormat?: string;
  creativeName?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
  primaryText?: string;
  headline?: string;
  callToAction?: string;
  linkUrl?: string;
  creativeFormatSource?: "meta_returned" | "not_enough_data";
};

export type LiveMetaAudit = {
  schemaVersion: "1.0";
  auditId: string;
  source: "META_ADS_MCP";
  accountId: string;
  retrievedAt: string;
  window: { since: string; until: string; days: 60 };
  campaigns: LiveAuditSection<LiveCampaignRow[]>;
  adSets: LiveAuditSection<LiveCampaignRow[]>;
  ads: LiveAuditSection<LiveCampaignRow[]>;
  opportunity: LiveAuditSection<{ score?: number; recommendations: unknown[] }>;
  errors: LiveAuditSection<{ count: number; items: unknown[] }>;
  trend: LiveAuditSection<unknown>;
  advisories: string[];
};

export async function runLiveMetaAudit(accessToken: string, accountId: string, advertiserRequest?: string): Promise<LiveMetaAudit> {
  const auditId = crypto.randomUUID();
  const context: MetaRequestContext = {
    clientConversationId: auditId,
    advertiserRequest: advertiserRequest || `Run AdPilot's fixed 60-day read-only campaign audit for Meta ad account ${accountId}.`,
  };
  const until = toDateString(new Date());
  const sinceDate = new Date();
  sinceDate.setUTCDate(sinceDate.getUTCDate() - 59);
  const since = toDateString(sinceDate);

  const campaignFields = [
    "id", "name", "objective", "status", "effective_status", "amount_spent", "impressions", "reach", "clicks", "ctr", "cpc", "cpm", "frequency",
    "results", "cost_per_result", "landing_page_view", "omni_landing_page_view", "offsite_conversion_fb_pixel_purchase", "omni_purchase",
    "offsite_conversion_fb_pixel_purchase_values", "omni_purchase_values", "purchase_roas", "website_purchase_roas", "daily_budget", "created_time", "start_time", "stop_time",
  ];
  const entityFields = [...campaignFields, "campaign_id", "adset_id", "ad_id", "creative_id", "creative_name", "thumbnail_url", "image_url", "video_url", "body", "title", "call_to_action_type", "link_url"];
  const [fieldContext, campaignCall, adSetCall, adCall, opportunityCall, trendCall] = await Promise.all([
    // TODO(verify-schema): Meta's public MCP reference describes this tool but does not publish its current input property name.
    safeToolCall(accessToken, "ads_get_field_context", { field_names: campaignFields }, context, 6_000),
    safeToolCall(accessToken, "ads_get_ad_entities", {
      ad_account_id: accountId,
      level: "campaign",
      fields: campaignFields,
      time_range: JSON.stringify({ since, until }),
      sort: "amount_spent_descending",
      limit: 300,
    }, context, 8_000),
    // Deep hierarchy reads are intentionally deferred: account-wide ad-set/ad
    // requests frequently time out on large accounts. Use a focused drill-down
    // request for creative detail instead of blocking the base audit.
    Promise.resolve({ status: "unavailable" as const, message: "Ad-set and creative detail is available via focused drill-down; not requested in the base audit." }),
    Promise.resolve({ status: "unavailable" as const, message: "Ad-set and creative detail is available via focused drill-down; not requested in the base audit." }),
    safeToolCall(accessToken, "ads_get_opportunity_score", { ad_account_id: accountId }, context, 8_000),
    safeToolCall(accessToken, "ads_insights_performance_trend", { ad_account_id: accountId }, context, 8_000),
  ]);
  const campaigns = normalizeCampaignSection(campaignCall);
  const campaignIds = campaigns.status === "ok" ? campaigns.data.slice(0, 20).map((campaign) => campaign.id) : [];
  const errorsCall = campaignIds.length
    ? await safeToolCall(accessToken, "ads_get_errors", { entity_ids: campaignIds, limit: 50 }, context, 5_000)
    : { status: "unavailable" as const, message: "Delivery issues are unavailable because Meta returned no campaign IDs for this audit." };

  return {
    schemaVersion: "1.0",
    auditId,
    source: "META_ADS_MCP",
    accountId,
    retrievedAt: new Date().toISOString(),
    window: { since, until, days: 60 },
    campaigns,
    adSets: normalizeCampaignSection(adSetCall),
    ads: normalizeCampaignSection(adCall),
    opportunity: normalizeOpportunitySection(opportunityCall),
    errors: normalizeErrorsSection(errorsCall),
    trend: trendCall.status === "ok"
      ? { status: "ok", data: decodeProviderValue(trendCall.data), raw: trendCall.data }
      : trendCall,
    advisories: fieldContext.status === "unavailable" ? [`Field metadata verification was unavailable: ${fieldContext.message}`] : [],
  };
}

type ToolCallResult = { status: "ok"; data: unknown } | { status: "unavailable"; message: string };

async function safeToolCall(
  accessToken: string,
  tool: MetaReadTool,
  args: Record<string, unknown>,
  context: MetaRequestContext,
  timeoutMs?: number,
): Promise<ToolCallResult> {
  try {
    const result = await callMetaReadTool(accessToken, tool, args, context, { timeoutMs });
    return { status: "ok", data: unwrapMetaToolResult(result) };
  } catch (error) {
    return { status: "unavailable", message: error instanceof Error ? error.message : `${tool} is unavailable.` };
  }
}

function normalizeCampaignSection(result: ToolCallResult): LiveAuditSection<LiveCampaignRow[]> {
  if (result.status === "unavailable") return result;
  const rows = findRows(decodeProviderValue(result.data))
    .map(normalizeCampaign)
    .filter((row): row is LiveCampaignRow => Boolean(row))
    .sort((left, right) => (right.spend ?? 0) - (left.spend ?? 0));
  return { status: "ok", data: rows, raw: result.data };
}

function normalizeOpportunitySection(result: ToolCallResult): LiveMetaAudit["opportunity"] {
  if (result.status === "unavailable") return result;
  const decoded = decodeProviderValue(result.data);
  const rawScore = findNumberByKeys(decoded, ["opportunity_score", "score", "optimization_score"]);
  const score = rawScore && rawScore > 0 ? rawScore : undefined;
  const recommendations = findArrayByKeys(decoded, ["recommendations", "opportunities", "items"]);
  return { status: "ok", data: { score, recommendations }, raw: result.data };
}

function normalizeErrorsSection(result: ToolCallResult): LiveMetaAudit["errors"] {
  if (result.status === "unavailable") return result;
  const items = collectErrorItems(decodeProviderValue(result.data));
  return { status: "ok", data: { count: items.length, items }, raw: result.data };
}

function decodeProviderValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
      try {
        return decodeProviderValue(JSON.parse(trimmed), depth + 1);
      } catch {
        return value;
      }
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => decodeProviderValue(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, decodeProviderValue(nested, depth + 1)]),
  );
}

function collectErrorItems(value: unknown, valuesAreErrors = false): unknown[] {
  if (typeof value === "string") return valuesAreErrors && value.trim() ? [value] : [];
  if (Array.isArray(value)) return value.flatMap((item) => collectErrorItems(item, valuesAreErrors));
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  if (record.error_message !== undefined || (valuesAreErrors && (record.message !== undefined || record.error_code !== undefined))) {
    return [record];
  }
  return Object.entries(record).flatMap(([key, nested]) => collectErrorItems(nested, key === "errors"));
}

function normalizeCampaign(value: unknown): LiveCampaignRow | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  const rawId = firstValue(row, ["id", "campaign_id"]);
  if (rawId === undefined) return undefined;
  const id = String(rawId);
  return {
    id,
    campaignId: stringValue(firstValue(row, ["campaign_id", "campaignId"])),
    adSetId: stringValue(firstValue(row, ["adset_id", "ad_set_id", "adSetId"])),
    name: stringValue(firstValue(row, ["name", "campaign_name"])) || `Campaign ${id}`,
    objective: stringValue(firstValue(row, ["objective", "campaign_objective"])),
    status: stringValue(row.status),
    effectiveStatus: stringValue(firstValue(row, ["effective_status", "status"])),
    spend: numberValue(firstValue(row, ["amount_spent", "spend"])),
    impressions: numberValue(row.impressions),
    clicks: numberValue(row.clicks),
    reach: numberValue(row.reach),
    ctr: normalizeRate(numberValue(row.ctr)),
    cpc: numberValue(row.cpc),
    cpm: numberValue(row.cpm),
    frequency: numberValue(row.frequency),
    results: resultValue(row.results),
    costPerResult: resultValue(row.cost_per_result),
    landingPageViews: numberValue(firstValue(row, ["omni_landing_page_view", "landing_page_view"])),
    purchases: numberValue(firstValue(row, ["omni_purchase", "offsite_conversion_fb_pixel_purchase", "results"])),
    purchaseValue: numberValue(firstValue(row, ["omni_purchase_values", "offsite_conversion_fb_pixel_purchase_values"])),
    purchaseRoas: numberValue(firstValue(row, ["purchase_roas", "website_purchase_roas"])),
    dailyBudget: numberValue(row.daily_budget),
    createdTime: stringValue(row.created_time),
    startTime: stringValue(row.start_time),
    stopTime: stringValue(row.stop_time),
    creativeName: stringValue(firstValue(row, ["creative_name", "creativeName"])),
    thumbnailUrl: stringValue(firstValue(row, ["thumbnail_url", "thumbnailUrl"])),
    imageUrl: stringValue(firstValue(row, ["image_url", "imageUrl"])),
    videoUrl: stringValue(firstValue(row, ["video_url", "videoUrl"])),
    primaryText: stringValue(firstValue(row, ["body", "primary_text", "primaryText"])),
    headline: stringValue(firstValue(row, ["title", "headline"])),
    callToAction: stringValue(firstValue(row, ["call_to_action_type", "callToAction"])),
    linkUrl: stringValue(firstValue(row, ["link_url", "linkUrl"])),
  };
}

function normalizeRate(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value) || value < 0) return undefined;
  const normalized = value > 1 ? value / 100 : value;
  return normalized <= 1 ? normalized : undefined;
}

function findRows(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  for (const key of ["data", "campaigns", "ad_entities", "entities", "items", "results"]) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  for (const nested of Object.values(record)) {
    const rows = findRows(nested);
    if (rows.length) return rows;
  }
  return [];
}

function findArrayByKeys(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  for (const key of keys) if (Array.isArray(record[key])) return record[key] as unknown[];
  for (const nested of Object.values(record)) {
    const found = findArrayByKeys(nested, keys);
    if (found.length) return found;
  }
  return [];
}

function findNumberByKeys(value: unknown, keys: string[]): number | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const number = numberValue(record[key]);
    if (number !== undefined) return number;
  }
  for (const nested of Object.values(record)) {
    const number = findNumberByKeys(nested, keys);
    if (number !== undefined) return number;
  }
  return undefined;
}

function firstValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) if (record[key] !== undefined) return record[key];
  return undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    const parsed = match ? Number(match[0]) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function resultValue(value: unknown): number | undefined {
  const scalar = numberValue(value);
  if (scalar !== undefined) return scalar;
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.values)) {
    const first = record.values[0];
    if (first && typeof first === "object") return numberValue((first as Record<string, unknown>).value);
  }
  return numberValue(record.value);
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}
