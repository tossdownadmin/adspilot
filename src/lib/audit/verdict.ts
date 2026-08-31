import { loadBrain } from "../brain/load-brain";
import type { AuditResult } from "../intelligence-domain";

export type CampaignVerdictAction = "SCALE" | "REFRESH" | "HOLD" | "STOP_REBUILD" | "KEEP_GATHERING" | "REFERENCE_ONLY";

export type CampaignVerdict = {
  campaignId: string;
  action: CampaignVerdictAction;
  label: string;
  reason: string;
};

const brain = loadBrain().brain;

function isPaused(status?: string) {
  return /(paused|archived|deleted|inactive)/i.test(status || "");
}

function isHealthy(result: AuditResult) {
  const floor = brain.scoring.absoluteFloor[result.campaign.objective];
  if (result.campaign.objective === "sales") {
    const salesFloor = floor as typeof brain.scoring.absoluteFloor.sales;
    return (result.metrics.roas ?? 0) >= salesFloor.roas || (result.metrics.cpa ?? Infinity) <= salesFloor.maxCpa;
  }
  if (result.campaign.objective === "awareness") {
    return (result.metrics.costPerThousandReached ?? Infinity) <= (floor as typeof brain.scoring.absoluteFloor.awareness).maxCostPerThousandReached;
  }
  return (result.metrics.cpa ?? Infinity) <= (floor as { maxCpa: number }).maxCpa;
}

export function campaignVerdict(result: AuditResult): CampaignVerdict {
  const base = { campaignId: result.campaign.campaignId };
  if (isPaused(result.campaign.deliveryStatus)) return { ...base, action: "REFERENCE_ONLY", label: "Reference only", reason: "This campaign is not currently active; do not recommend live changes unless it is reactivated." };
  if (!result.significant || result.tier === "insufficient_data") return { ...base, action: "KEEP_GATHERING", label: "Keep gathering evidence", reason: `Missing evidence: ${result.gateFailures.join(", ").replaceAll("_", " ") || "minimum objective threshold"}.` };
  const healthy = isHealthy(result);
  const saturated = (result.metrics.frequency ?? 0) > brain.scoring.nuance.frequencySaturationThreshold;
  if (healthy && saturated) return { ...base, action: "REFRESH", label: "Refresh creative / widen audience", reason: "Absolute performance is healthy, but frequency is above the configured saturation threshold." };
  if (result.tier === "winner") return { ...base, action: "SCALE", label: "Scale cautiously", reason: "Evidence-qualified winner with frequency inside the configured range; increase budget in 10–15% steps." };
  if (result.tier === "kill_candidate") return { ...base, action: "STOP_REBUILD", label: "Stop / rebuild", reason: "Weak absolute and relative performance; review the setup before spending further." };
  if (result.tier === "contender" && healthy) return { ...base, action: "HOLD", label: "Hold / maintain", reason: "Performance clears the absolute health floor; keep stable and test one controlled improvement." };
  return { ...base, action: "HOLD", label: "Hold and diagnose", reason: "Keep budget stable while investigating the weakest objective-specific signal." };
}

export function campaignVerdicts(results: AuditResult[]) {
  return results.map(campaignVerdict);
}
