import { describe, expect, it } from "vitest";
import { auditCampaigns, buildAccountDiagnosis, buildIntelligencePlaybook, deriveMetrics, retrieveReferences, significanceFailures } from "./intelligence-engine";
import { demoCampaigns } from "./intelligence-fixtures";

describe("campaign intelligence audit", () => {
  const results = auditCampaigns(demoCampaigns);

  it("derives authoritative metrics from raw account data", () => {
    const metrics = deriveMetrics(demoCampaigns[0]);
    expect(metrics.roas).toBeCloseTo(4.6, 1);
    expect(metrics.ctr).toBeCloseTo(0.0228, 3);
    expect(metrics.cpa).toBe(4.5);
  });

  it("keeps attractive but immature campaigns out of scoring", () => {
    const early = results.find((result) => result.campaign.campaignId === "camp_4498");
    expect(early?.tier).toBe("insufficient_data");
    expect(early?.score).toBeNull();
    expect(early?.eligibleReference).toBe(false);
    expect(significanceFailures(early!.campaign)).toContain("min_purchases_15");
  });

  it("isolates campaigns by objective and JTD cohort", () => {
    const lto = results.find((result) => result.campaign.campaignId === "camp_8842");
    expect(lto?.cohortKey).toBe("sales:promote_lto");
    expect(lto?.cohortSize).toBe(5);
    expect(lto?.contributions.reduce((sum, metric) => sum + metric.weight, 0)).toBeCloseTo(1);
  });

  it("excludes critical tracking gaps from reference eligibility", () => {
    const trackingGap = results.find((result) => result.campaign.campaignId === "camp_3205");
    expect(trackingGap?.nuanceFlags).toContain("tracking_gap");
    expect(trackingGap?.eligibleReference).toBe(false);
  });

  it("does not declare relative winners or kill candidates in small cohorts", () => {
    const smallCohort = results.filter((result) => result.cohortSize < 5 && result.significant);
    expect(smallCohort.every((result) => result.tier !== "winner" && result.tier !== "kill_candidate")).toBe(true);
    expect(smallCohort.every((result) => result.eligibleReference === false)).toBe(true);
  });

  it("falls back to objective peers when a specific JTD has too few comparisons", () => {
    const loneJtd = { ...demoCampaigns[0], campaignId: "camp_lone_jtd", name: "Lapsed Buyer Test", jtd: "reactivate_lapsed" as const };
    const fallback = auditCampaigns([...demoCampaigns, loneJtd]).find((result) => result.campaign.campaignId === loneJtd.campaignId);
    expect(fallback?.cohortKey).toBe("sales:all");
    expect(fallback?.cohortSize).toBeGreaterThanOrEqual(5);
  });

  it("produces an objective-aware account diagnosis", () => {
    const diagnosis = buildAccountDiagnosis(results);
    expect(diagnosis.summary.campaigns).toBe(results.length);
    expect(diagnosis.summary.knownJtdCampaigns).toBeGreaterThan(0);
    expect(diagnosis.summary.knownJtdShare).toBeGreaterThan(0);
    expect(diagnosis.bestByObjective.sales?.[0].winningMetric).toBeTruthy();
    expect(diagnosis.wasteCandidates.every((campaign) => campaign.tier === "underperformer" || campaign.tier === "kill_candidate")).toBe(true);
    expect(diagnosis.dimensionLeaders.region.length).toBeGreaterThan(0);
  });
});

describe("reference retrieval and synthesis", () => {
  const results = auditCampaigns(demoCampaigns);
  const brief = { region: "MD-DC", product: "pizza", objective: "sales" as const, jtd: "promote_lto" as const, dailyBudget: 50, offer: "Weekend family bundle" };

  it("finds references without ever selecting insufficient data", () => {
    const references = retrieveReferences(results, brief);
    expect(references.closestBest?.matchedRung).toEqual(["region", "product", "jtd", "objective"]);
    expect(references.closestBest?.result.tier).toBe("winner");
    expect(references.closestBest?.result.campaign.campaignId).not.toBe("camp_4498");
    expect(references.overallBest?.result.tier).toBe("winner");
  });

  it("records field provenance in the generated playbook", () => {
    const playbook = buildIntelligencePlaybook(results, brief, 200);
    expect(playbook.recommendationMode).not.toBe("cold_start");
    expect(playbook.config.initialStatus).toBe("PAUSED");
    expect(playbook.provenance["config.objective"].source).toBe("user_brief");
    expect(playbook.evidence.length).toBeGreaterThan(0);
    expect(playbook.reviewRequired).toBe(true);
  });

  it("returns an honest cold start when no eligible winner exists", () => {
    const playbook = buildIntelligencePlaybook(results, { ...brief, objective: "awareness", jtd: "new_location_awareness" });
    expect(playbook.recommendationMode).toBe("cold_start");
    expect(playbook.warnings[0]).toMatch(/No eligible historical winner/);
    expect(playbook.confidence).toBeLessThan(.5);
  });
});
