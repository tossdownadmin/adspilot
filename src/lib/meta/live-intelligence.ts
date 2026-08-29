import type { DimensionSource, HistoricalCampaign, IntelligenceObjective, Jtd } from "@/lib/intelligence-domain";
import type { LiveCampaignRow } from "./live-audit";

export function liveCampaignsToHistory(
  campaigns: LiveCampaignRow[],
  window: { since: string; until: string },
): HistoricalCampaign[] {
  return campaigns.map((campaign) => toHistoricalCampaign(campaign, window));
}

function toHistoricalCampaign(campaign: LiveCampaignRow, window: { since: string; until: string }): HistoricalCampaign {
  const objective = normalizeObjective(campaign.objective);
  const inferredJtd = inferJtd(campaign.name);
  const reportingDays = activeDays(campaign, window);
  const purchases = campaign.purchases ?? (objective === "sales" ? campaign.results : undefined) ?? 0;
  const revenue = campaign.purchaseValue ?? (campaign.purchaseRoas !== undefined && campaign.spend !== undefined ? campaign.purchaseRoas * campaign.spend : 0);
  const outcomes = objective === "sales" || objective === "leads" ? purchases || campaign.results || 0 : campaign.results || 0;

  const region = inferRegion(campaign.name);
  const product = inferProduct(campaign.name);
  const creativeFormat = campaign.creativeFormat || "Not enough data";
  return {
    campaignId: campaign.id,
    name: campaign.name,
    deliveryStatus: campaign.status,
    region: region.value,
    product: product.value,
    objective,
    jtd: inferredJtd.jtd,
    jtdConfidence: inferredJtd.confidence,
    spend: campaign.spend ?? 0,
    impressions: campaign.impressions ?? 0,
    reach: campaign.reach ?? 0,
    clicks: campaign.clicks ?? 0,
    landingPageViews: campaign.landingPageViews ?? 0,
    conversions: outcomes,
    revenue,
    daysActive: reportingDays,
    dailySpend: campaign.dailyBudget ?? ((campaign.spend ?? 0) / Math.max(1, reportingDays)),
    trackingQuality: trackingQuality(objective, campaign),
    ageDays: ageInDays(campaign.createdTime),
    creativePattern: "Not returned at campaign level",
    audiencePattern: "Not returned at campaign level",
    offerPattern: "Not returned at campaign level",
    creativeFormat,
    regionSource: region.source,
    productSource: product.source,
    creativeFormatSource: campaign.creativeFormatSource === "meta_returned" ? "meta_returned" : "not_enough_data",
  };
}

function normalizeObjective(objective?: string): IntelligenceObjective {
  const value = objective?.toUpperCase() ?? "";
  if (value.includes("LEAD")) return "leads";
  if (value.includes("TRAFFIC")) return "traffic";
  if (value.includes("AWARENESS") || value.includes("REACH")) return "awareness";
  return "sales";
}

function inferJtd(name: string): { jtd: Jtd; confidence: number } {
  const value = name.toLowerCase();
  if (/retarget|remarket|reactivat|lapsed/.test(value)) return { jtd: "reactivate_lapsed", confidence: .86 };
  if (/prospect|acqui|new customer|first order/.test(value)) return { jtd: "acquire_new", confidence: .82 };
  if (/cater|office|event/.test(value)) return { jtd: "drive_catering", confidence: .8 };
  if (/loyal|reward|member/.test(value)) return { jtd: "loyalty_signup", confidence: .8 };
  if (/launch|opening|new location/.test(value)) return { jtd: "new_location_awareness", confidence: .75 };
  if (/offer|deal|promo|special|bundle|lto|weekend/.test(value)) return { jtd: "promote_lto", confidence: .72 };
  return { jtd: "unknown", confidence: .35 };
}

function inferRegion(name: string): { value: string; source: DimensionSource } {
  const parts = name.split("|").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 4 && parts[3]) return { value: parts[3], source: "inferred_from_campaign_name" };
  if (/corporate|nationwide|all markets|all locations/i.test(name)) return { value: "All markets", source: "inferred_from_campaign_name" };
  return { value: "Not enough data", source: "not_enough_data" };
}

function inferProduct(name: string): { value: string; source: DimensionSource } {
  if (/cater/i.test(name)) return { value: "Catering", source: "inferred_from_campaign_name" };
  if (/loyal|reward/i.test(name)) return { value: "Loyalty", source: "inferred_from_campaign_name" };
  if (/pizza|slice|pie/i.test(name)) return { value: "Pizza", source: "inferred_from_campaign_name" };
  return { value: "Not enough data", source: "not_enough_data" };
}

function activeDays(campaign: LiveCampaignRow, window: { since: string; until: string }) {
  const windowStart = Date.parse(`${window.since}T00:00:00Z`);
  const windowEnd = Date.parse(`${window.until}T00:00:00Z`);
  const campaignStart = parseDate(campaign.startTime) ?? parseDate(campaign.createdTime) ?? windowStart;
  const campaignEnd = parseDate(campaign.stopTime) ?? windowEnd;
  const start = Math.max(windowStart, campaignStart);
  const end = Math.min(windowEnd, campaignEnd);
  return Math.max(1, Math.floor((end - start) / 86_400_000) + 1);
}

function ageInDays(createdTime?: string) {
  const created = parseDate(createdTime);
  return created === undefined ? 0 : Math.max(0, Math.floor((Date.now() - created) / 86_400_000));
}

function parseDate(value?: string) {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function trackingQuality(objective: IntelligenceObjective, campaign: LiveCampaignRow): HistoricalCampaign["trackingQuality"] {
  if (objective === "sales" && campaign.purchases === undefined && campaign.purchaseRoas === undefined && campaign.purchaseValue === undefined) return "warning";
  if (objective === "leads" && campaign.results === undefined) return "warning";
  return "good";
}
