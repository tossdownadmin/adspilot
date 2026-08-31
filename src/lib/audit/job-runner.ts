import { buildPresentation } from "../agent/adpilot-agent";
import { auditCampaigns } from "../intelligence-engine";
import type { AuditResult } from "../intelligence-domain";
import { runLiveMetaAudit, type LiveCampaignRow, type LiveMetaAudit } from "../meta/live-audit";
import { liveCampaignsToHistory } from "../meta/live-intelligence";
import { callMetaReadTool, unwrapMetaToolResult } from "../meta/mcp-client";
import { createAuditJob, emitAuditEvent, finishAuditJob, getAuditJob, patchAuditReport, type AuditCampaignRow, type AuditJobSnapshot, type AuditProgressEvent, type AuditStageName } from "./job-store";
import { synthesizeAuditBatches } from "./synthesis";
import { campaignVerdicts } from "./verdict";

const stageLabels: Record<AuditStageName, string> = {
  scope: "Connecting to the account…", pull: "Pulling 60 days of campaigns…", score: "Scoring and tiering campaigns…",
  winners: "Studying what’s working…", losers: "Investigating the waste…", trends: "Tracing fatigue over time…",
  breakdowns: "Breaking down placement and audience…", creatives: "Reading the creative…", synthesis: "Writing it up…", assemble: "Assembling the audit…",
};

export type AuditStage = { name: AuditStageName; label: string; run: () => Promise<unknown> };

type AuditExecution = {
  input: { accountId: string; prompt: string };
  accessToken: string;
  stages?: AuditStage[];
};

const executionRuntime = globalThis as typeof globalThis & { __adpilotAuditExecutions?: Map<string, AuditExecution> };
const auditExecutions = executionRuntime.__adpilotAuditExecutions ??= new Map<string, AuditExecution>();

export async function runAuditStages(jobId: string, stages: AuditStage[]) {
  for (const stage of stages) {
    emitAuditEvent(event(jobId, stage, "running"));
    try {
      const partial = await stage.run();
      emitAuditEvent(event(jobId, stage, partial === undefined ? "skipped" : "done", partial));
    } catch (error) {
      emitAuditEvent(event(jobId, stage, "error", undefined, error instanceof Error ? error.message : "Stage unavailable."));
    }
  }
}

function event(jobId: string, stage: AuditStage, status: AuditProgressEvent["status"], partial?: unknown, error?: string): AuditProgressEvent {
  return { jobId, stage: stage.name, label: stage.label, status, partial, error, at: new Date().toISOString() };
}

function active(status?: string) { return !status || String(status).toUpperCase() === "ACTIVE"; }

function rows(results: AuditResult[]): AuditCampaignRow[] {
  const verdicts = new Map(campaignVerdicts(results).map((verdict) => [verdict.campaignId, verdict]));
  return results.map((result) => ({
    campaignId: result.campaign.campaignId, name: result.campaign.name, objective: result.campaign.objective,
    spend: result.campaign.spend, score: result.score, tier: result.tier, deliveryStatus: result.campaign.deliveryStatus || "Not returned",
    roas: result.metrics.roas, cpa: result.metrics.cpa, frequency: result.metrics.frequency, verdict: verdicts.get(result.campaign.campaignId)!,
  }));
}

function liveRows(section: LiveMetaAudit["ads"]): LiveCampaignRow[] { return section.status === "ok" ? section.data : []; }

async function metaCall(token: string, name: Parameters<typeof callMetaReadTool>[1], args: Record<string, unknown>, request: string, timeoutMs = 12_000) {
  return unwrapMetaToolResult(await callMetaReadTool(token, name, args, { clientConversationId: crypto.randomUUID().replaceAll("-", "").slice(0, 20), advertiserRequest: request }, { timeoutMs }));
}

export function startAuditJob(input: { accountId: string; prompt: string }, accessToken: string) {
  const jobId = `audit_${crypto.randomUUID()}`;
  const stages = (Object.keys(stageLabels) as AuditStageName[]).map((stage) => ({ stage, label: stageLabels[stage], status: "pending" as const }));
  createAuditJob(jobId, input.accountId, stages);
  auditExecutions.set(jobId, { input, accessToken });
  return getAuditJob(jobId)!;
}

function buildAuditStages(jobId: string, input: { accountId: string; prompt: string }, accessToken: string) {
  let audit: LiveMetaAudit | undefined;
  let results: AuditResult[] = [];
  let campaignRows: AuditCampaignRow[] = [];
  const focusedIds = () => [...campaignRows].filter((row) => ["SCALE", "REFRESH", "STOP_REBUILD"].includes(row.verdict.action)).sort((a, b) => b.spend - a.spend).slice(0, 12).map((row) => row.campaignId);
  return [
    { name: "scope", label: stageLabels.scope, run: async () => {
      const accounts = await metaCall(accessToken, "ads_get_ad_accounts", {}, input.prompt, 8_000);
      const partial = { accountId: input.accountId, connected: true, accountEvidence: accounts };
      patchAuditReport(jobId, { accountId: input.accountId }); return partial;
    } },
    { name: "pull", label: stageLabels.pull, run: async () => {
      audit = await runLiveMetaAudit(accessToken, input.accountId, input.prompt);
      patchAuditReport(jobId, { window: audit.window, gaps: audit.advisories });
      return { window: audit.window, campaigns: audit.campaigns.status === "ok" ? audit.campaigns.data.length : 0 };
    } },
    { name: "score", label: stageLabels.score, run: async () => {
      if (!audit || audit.campaigns.status !== "ok") throw new Error("Campaign data was unavailable.");
      results = auditCampaigns(liveCampaignsToHistory(audit.campaigns.data.filter((row) => active(row.effectiveStatus || row.status)), audit.window));
      campaignRows = rows(results).sort((a, b) => b.spend - a.spend);
      const working = campaignRows.filter((row) => ["SCALE", "REFRESH", "HOLD"].includes(row.verdict.action)).length;
      const summary = { campaigns: results.length, significant: results.filter((result) => result.significant).length, spend: results.reduce((sum, result) => sum + result.campaign.spend, 0), working };
      patchAuditReport(jobId, { summary, campaigns: campaignRows }); return { summary, campaigns: campaignRows };
    } },
    { name: "winners", label: stageLabels.winners, run: async () => {
      if (!audit) throw new Error("Audit evidence is unavailable.");
      const winners = campaignRows.filter((row) => ["SCALE", "REFRESH", "HOLD"].includes(row.verdict.action)).sort((a, b) => (b.score ?? -1) - (a.score ?? -1)).slice(0, 12);
      const adSets = liveRows(audit.adSets).filter((row) => !row.campaignId || winners.some((winner) => winner.campaignId === row.campaignId));
      patchAuditReport(jobId, { winners, adSets }); return { winners, adSets };
    } },
    { name: "losers", label: stageLabels.losers, run: async () => {
      const losers = campaignRows.filter((row) => row.verdict.action === "STOP_REBUILD").sort((a, b) => b.spend - a.spend).slice(0, 12);
      patchAuditReport(jobId, { losers }); return { losers };
    } },
    { name: "trends", label: stageLabels.trends, run: async () => {
      if (!audit) throw new Error("Audit evidence is unavailable.");
      const trends = audit.trend.status === "ok" ? audit.trend.data : undefined;
      patchAuditReport(jobId, { trends }); return trends;
    } },
    { name: "breakdowns", label: stageLabels.breakdowns, run: async () => {
      const ids = focusedIds(); if (!ids.length || !audit) return undefined;
      const common = { ad_account_id: input.accountId, level: "ad", fields: ["id", "name", "campaign_id", "amount_spent", "impressions", "clicks", "results", "cost_per_result"], filtering: [{ field: "campaign_id", operator: "IN", value: ids }], time_range: JSON.stringify({ since: audit.window.since, until: audit.window.until }), limit: 200 };
      // TODO(verify-schema): confirm the exact supported breakdown combinations for the connected Meta MCP version.
      const [placement, audience] = await Promise.all([
        metaCall(accessToken, "ads_get_ad_entities", { ...common, breakdowns: ["publisher_platform", "platform_position"] }, input.prompt),
        metaCall(accessToken, "ads_get_ad_entities", { ...common, breakdowns: ["age", "gender"] }, input.prompt),
      ]);
      const breakdowns = { placement, audience }; patchAuditReport(jobId, { breakdowns }); return breakdowns;
    } },
    { name: "creatives", label: stageLabels.creatives, run: async () => {
      if (!audit) throw new Error("Audit evidence is unavailable.");
      const liveAds = liveRows(audit.ads).slice(0, 50);
      let creativeAssets: unknown;
      const creativeIds = [...new Set(liveAds.map((row) => row.creativeId).filter((id): id is string => Boolean(id)))].slice(0, 50);
      if (creativeIds.length) {
        try {
          // TODO(verify-schema): confirm `creative_ids` against the connected ads MCP tool definition.
          creativeAssets = await metaCall(accessToken, "ads_get_creatives", { ad_account_id: input.accountId, creative_ids: creativeIds }, input.prompt, 12_000);
        } catch (error) {
          creativeAssets = { status: "unavailable", message: error instanceof Error ? error.message : "Creative asset resolution was unavailable." };
        }
      }
      const creatives = liveAds.map((row) => ({ id: row.id, creativeId: row.creativeId, campaignId: row.campaignId, adSetId: row.adSetId, name: row.creativeName || row.name, spend: row.spend ?? 0, conversions: row.purchases ?? row.results ?? 0, ctr: row.impressions && row.clicks !== undefined ? row.clicks / row.impressions : row.ctr ?? null, frequency: row.frequency ?? null, thumbnailUrl: row.thumbnailUrl, assetUrl: row.imageUrl ?? row.videoUrl, primaryText: row.primaryText, headline: row.headline, callToAction: row.callToAction }));
      patchAuditReport(jobId, { creatives, creativeAssets }); return { creatives, creativeAssets };
    } },
    { name: "synthesis", label: stageLabels.synthesis, run: async () => {
      const report = getAuditJob(jobId)?.report; if (!report) throw new Error("Audit report is unavailable.");
      const narratives = await synthesizeAuditBatches(report); patchAuditReport(jobId, { narratives }); return narratives;
    } },
    { name: "assemble", label: stageLabels.assemble, run: async () => {
      const report = getAuditJob(jobId)?.report; if (!report) throw new Error("Audit report is unavailable.");
      const narratives = report.narratives ?? {};
      const answer = ["## TL;DR", narratives.summary, "## What is working", narratives.winners, "## What needs attention", narratives.losers, "## Creative findings", narratives.creatives, "## Trends and saturation", narratives.trends].filter(Boolean).join("\n\n");
      const presentation = audit ? buildPresentation(results, audit) : undefined;
      patchAuditReport(jobId, { answer, presentation }); return { answer, presentation };
    } },
  ] satisfies AuditStage[];
}

export async function advanceAuditJob(jobId: string) {
  const job = getAuditJob(jobId);
  const execution = auditExecutions.get(jobId);
  if (!job || !execution || job.status !== "running") return job;
  execution.stages ??= buildAuditStages(jobId, execution.input, execution.accessToken);
  const runningIndex = job.stages.findIndex((stage) => stage.status === "running");
  if (runningIndex < 0) {
    const pendingIndex = job.stages.findIndex((stage) => stage.status === "pending");
    if (pendingIndex < 0) {
      finishAuditJob(jobId, job.report.answer ? "complete" : "failed");
      auditExecutions.delete(jobId);
      return getAuditJob(jobId);
    }
    const stage = execution.stages[pendingIndex];
    emitAuditEvent(event(jobId, stage, "running"));
    return getAuditJob(jobId);
  }
  const stage = execution.stages[runningIndex];
  try {
    const partial = await stage.run();
    emitAuditEvent(event(jobId, stage, partial === undefined ? "skipped" : "done", partial));
  } catch (error) {
    emitAuditEvent(event(jobId, stage, "error", undefined, error instanceof Error ? error.message : "Stage unavailable."));
  }
  const remaining = getAuditJob(jobId)?.stages.some((item) => item.status === "pending" || item.status === "running");
  if (!remaining) {
    finishAuditJob(jobId, getAuditJob(jobId)?.report.answer ? "complete" : "failed");
    auditExecutions.delete(jobId);
  }
  return getAuditJob(jobId);
}

export async function runDeepAuditJob(jobId: string, input: { accountId: string; prompt: string }, accessToken: string) {
  await runAuditStages(jobId, buildAuditStages(jobId, input, accessToken));
  finishAuditJob(jobId, getAuditJob(jobId)?.report.answer ? "complete" : "failed");
  return getAuditJob(jobId);
}

export function auditJobSnapshot(job: AuditJobSnapshot) { return job; }
