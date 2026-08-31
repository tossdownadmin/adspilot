import type { AgentPresentation } from "../agent/adpilot-agent";
import type { CampaignVerdict } from "./verdict";

export type AuditStageName = "scope" | "pull" | "score" | "winners" | "losers" | "trends" | "breakdowns" | "creatives" | "synthesis" | "assemble";
export type AuditStageStatus = "pending" | "running" | "done" | "skipped" | "error";

export type AuditProgressEvent = {
  jobId: string;
  stage: AuditStageName;
  label: string;
  status: Exclude<AuditStageStatus, "pending">;
  partial?: unknown;
  error?: string;
  at: string;
};

export type AuditCampaignRow = {
  campaignId: string; name: string; objective: string; spend: number; score: number | null; tier: string;
  deliveryStatus: string; roas: number | null; cpa: number | null; frequency: number | null; verdict: CampaignVerdict;
};

export type AuditReport = {
  accountId: string;
  window?: { since: string; until: string; days: number };
  summary?: { campaigns: number; significant: number; spend: number; working: number };
  campaigns?: AuditCampaignRow[];
  winners?: AuditCampaignRow[];
  losers?: AuditCampaignRow[];
  adSets?: unknown[];
  creatives?: unknown[];
  creativeAssets?: unknown;
  trends?: unknown;
  breakdowns?: Record<string, unknown>;
  narratives?: Record<string, string>;
  answer?: string;
  presentation?: AgentPresentation;
  gaps?: string[];
};

export type AuditJobSnapshot = {
  jobId: string;
  status: "running" | "complete" | "failed";
  stages: Array<{ stage: AuditStageName; label: string; status: AuditStageStatus; error?: string }>;
  report: AuditReport;
  events: AuditProgressEvent[];
  createdAt: string;
  updatedAt: string;
};

type AuditRuntimeStore = {
  jobs: Map<string, AuditJobSnapshot>;
  listeners: Map<string, Set<(event: AuditProgressEvent | null) => void>>;
};

// Next compiles route handlers as separate module graphs. Keeping this V1
// registry on the Node process makes the start, status, and stream routes share
// one store inside an instance instead of each receiving its own Map.
// A durable shared store is still required before relying on multiple Vercel
// instances because process memory is not shared across instances.
const runtime = globalThis as typeof globalThis & { __adpilotAuditRuntime?: AuditRuntimeStore };
const auditRuntime = runtime.__adpilotAuditRuntime ??= {
  jobs: new Map<string, AuditJobSnapshot>(),
  listeners: new Map<string, Set<(event: AuditProgressEvent | null) => void>>(),
};
const { jobs, listeners } = auditRuntime;

export function createAuditJob(jobId: string, accountId: string, stages: AuditJobSnapshot["stages"]) {
  const now = new Date().toISOString();
  const job: AuditJobSnapshot = { jobId, status: "running", stages, report: { accountId }, events: [], createdAt: now, updatedAt: now };
  jobs.set(jobId, job);
  return job;
}

export function getAuditJob(jobId: string) { return jobs.get(jobId); }

export function patchAuditReport(jobId: string, patch: Partial<AuditReport>) {
  const job = jobs.get(jobId);
  if (!job) return;
  job.report = { ...job.report, ...patch };
  job.updatedAt = new Date().toISOString();
}

export function emitAuditEvent(event: AuditProgressEvent) {
  const job = jobs.get(event.jobId);
  if (!job) return;
  job.events.push(event);
  const stage = job.stages.find((item) => item.stage === event.stage);
  if (stage) { stage.status = event.status; stage.error = event.error; }
  job.updatedAt = event.at;
  listeners.get(event.jobId)?.forEach((listener) => listener(event));
}

export function finishAuditJob(jobId: string, status: "complete" | "failed" = "complete") {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = status;
  job.updatedAt = new Date().toISOString();
  listeners.get(jobId)?.forEach((listener) => listener(null));
}

export function subscribeAuditJob(jobId: string, listener: (event: AuditProgressEvent | null) => void) {
  const group = listeners.get(jobId) ?? new Set();
  group.add(listener); listeners.set(jobId, group);
  return () => { group.delete(listener); if (!group.size) listeners.delete(jobId); };
}

export function clearAuditJobsForTests() { jobs.clear(); listeners.clear(); }
