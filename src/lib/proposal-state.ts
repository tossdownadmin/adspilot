import type { AuditEvent, CampaignProposal } from "./domain";

const createId = (prefix: string) => `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;

export function approveProposal(proposal: CampaignProposal): CampaignProposal {
  if (proposal.findings.some((finding) => finding.severity === "blocker")) throw new Error("Resolve all policy blockers before approval.");
  const payloadHash = `sha256:${proposal.id.slice(-8)}${proposal.revision.toString().padStart(4, "0")}`;
  return { ...proposal, status: "APPROVED", approval: { approvedAt: new Date().toISOString(), payloadHash } };
}

export function executeProposal(proposal: CampaignProposal): CampaignProposal {
  if (proposal.status !== "APPROVED" || !proposal.approval) throw new Error("A valid approval is required.");
  const seed = proposal.id.slice(-7).toUpperCase();
  return { ...proposal, status: "LAUNCHED_PAUSED", execution: { executedAt: new Date().toISOString(), campaignId: `cmp_${seed}`, adSetId: `set_${seed}`, adIds: proposal.ads.map((_, index) => `ad_${seed}${index + 1}`), requestId: createId("req") } };
}

export function audit(action: string, detail: string, status: AuditEvent["status"] = "success", entityId?: string): AuditEvent {
  return { id: createId("evt"), createdAt: new Date().toISOString(), action, detail, status, entityId };
}
