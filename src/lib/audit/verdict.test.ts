import { describe, expect, it } from "vitest";
import { auditCampaigns } from "../intelligence-engine";
import { demoCampaigns } from "../intelligence-fixtures";
import { campaignVerdict } from "./verdict";

const base = auditCampaigns(demoCampaigns)[0];

describe("deterministic campaign verdicts", () => {
  it("keeps paused campaigns reference-only", () => {
    expect(campaignVerdict({ ...base, campaign: { ...base.campaign, deliveryStatus: "PAUSED" } }).action).toBe("REFERENCE_ONLY");
  });

  it("keeps gathering when evidence gates fail", () => {
    expect(campaignVerdict({ ...base, significant: false, tier: "insufficient_data", gateFailures: ["min_purchases_15"] }).action).toBe("KEEP_GATHERING");
  });

  it("refreshes a healthy campaign that is saturating", () => {
    expect(campaignVerdict({ ...base, tier: "contender", metrics: { ...base.metrics, roas: 10, frequency: 99 } }).action).toBe("REFRESH");
  });

  it("scales an in-range winner", () => {
    expect(campaignVerdict({ ...base, tier: "winner", metrics: { ...base.metrics, frequency: 1 } }).action).toBe("SCALE");
  });

  it("stops and rebuilds a weak kill candidate", () => {
    expect(campaignVerdict({ ...base, tier: "kill_candidate", metrics: { ...base.metrics, roas: 0, cpa: 999, frequency: 1 } }).action).toBe("STOP_REBUILD");
  });

  it("holds a healthy contender", () => {
    expect(campaignVerdict({ ...base, tier: "contender", metrics: { ...base.metrics, roas: 10, frequency: 1 } }).action).toBe("HOLD");
  });
});
