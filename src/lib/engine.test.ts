import { describe, expect, it } from "vitest";
import { approveProposal, executeProposal, generateProposal } from "./engine";
import { decideCampaignPlan, getBudgetTier, OBJECTIVE_RULES } from "./campaign-rules";
import type { CampaignBrief, Workspace } from "./domain";

const workspace: Workspace = {
  businessName: "Northstar",
  websiteUrl: "https://example.com",
  category: "Retail",
  currency: "USD",
  timezone: "Asia/Karachi",
  maxDailyBudget: 200,
  connected: true,
};

const brief: CampaignBrief = {
  businessName: "Northstar",
  productName: "Travel Pack",
  offerDescription: "A lightweight travel pack designed for organized weekend trips.",
  objective: "SALES",
  destinationUrl: "https://example.com/travel-pack",
  geography: "United States",
  currency: "USD",
  dailyBudget: 80,
  durationDays: 14,
  audienceHint: "Frequent travelers aged 25 to 44",
  brandVoice: "Direct and optimistic",
  extraInstructions: "",
};

describe("campaign engine", () => {
  it("creates an approvable proposal inside policy limits", () => {
    const proposal = generateProposal(brief, workspace);
    expect(proposal.status).toBe("READY_FOR_APPROVAL");
    expect(proposal.ads).toHaveLength(3);
    expect(proposal.budget.lifetime).toBe(1120);
    expect(proposal.plan.budgetTier).toBe("VALIDATION");
    expect(proposal.plan.creativeAngles).toEqual(["PRIMARY_BENEFIT", "PROBLEM_FRICTION", "USE_CASE"]);
  });

  it("blocks proposals over the daily ceiling", () => {
    const proposal = generateProposal({ ...brief, dailyBudget: 500 }, workspace);
    expect(proposal.status).toBe("VALIDATION_BLOCKED");
    expect(() => approveProposal(proposal)).toThrow(/blockers/i);
  });

  it("launches only an approved proposal in paused state", () => {
    const approved = approveProposal(generateProposal(brief, workspace));
    const launched = executeProposal(approved);
    expect(launched.status).toBe("LAUNCHED_PAUSED");
    expect(launched.execution?.campaignId).toMatch(/^cmp_/);
  });

  it("keeps lean budgets concentrated in two creative hypotheses", () => {
    const proposal = generateProposal({ ...brief, dailyBudget: 25 }, workspace);
    expect(proposal.plan.budgetTier).toBe("LEAN");
    expect(proposal.ads).toHaveLength(2);
    expect(proposal.plan.creativeAngles).toEqual(["PRIMARY_BENEFIT", "PROBLEM_FRICTION"]);
  });

  it("adds a proof challenger only for scale-ready budgets", () => {
    const proposal = generateProposal({ ...brief, dailyBudget: 150 }, workspace);
    expect(proposal.plan.budgetTier).toBe("SCALE_READY");
    expect(proposal.ads).toHaveLength(4);
    expect(proposal.plan.creativeAngles.at(-1)).toBe("PROOF_CONFIDENCE");
  });

  it("uses objective-specific measurement rules", () => {
    const leads = generateProposal({ ...brief, objective: "LEADS" }, workspace);
    const traffic = generateProposal({ ...brief, objective: "TRAFFIC" }, workspace);
    expect(leads.measurement.primaryMetric).toBe("Cost per lead");
    expect(leads.ads[0].callToAction).toBe("Get quote");
    expect(traffic.measurement.primaryMetric).toBe("Cost per landing page view");
    expect(traffic.ads[0].callToAction).toBe("Learn more");
  });

  it("blocks sensitive categories until compliance handling exists", () => {
    const proposal = generateProposal({ ...brief, productName: "Personal loan", offerDescription: "Apply for a flexible personal loan with clear repayment terms." }, workspace);
    expect(proposal.status).toBe("VALIDATION_BLOCKED");
    expect(proposal.findings).toEqual(expect.arrayContaining([expect.objectContaining({ code: "UNSUPPORTED_SENSITIVE_CATEGORY", severity: "blocker" })]));
  });

  it("warns on very low budgets and short tests", () => {
    const proposal = generateProposal({ ...brief, dailyBudget: 5, durationDays: 3 }, workspace);
    const codes = proposal.findings.map((finding) => finding.code);
    expect(codes).toContain("BUDGET_TOO_LOW_FOR_TESTING");
    expect(codes).toContain("SHORT_TEST_DURATION");
  });
});

describe("campaign planning rules", () => {
  it("uses stable budget boundaries", () => {
    expect(getBudgetTier(49)).toBe("LEAN");
    expect(getBudgetTier(50)).toBe("VALIDATION");
    expect(getBudgetTier(149)).toBe("VALIDATION");
    expect(getBudgetTier(150)).toBe("SCALE_READY");
  });

  it("keeps the prototype on one prospecting ad set", () => {
    expect(decideCampaignPlan({ dailyBudget: 25 }).structure).toBe("ONE_PROSPECTING_AD_SET");
    expect(decideCampaignPlan({ dailyBudget: 500 }).structure).toBe("ONE_PROSPECTING_AD_SET");
  });

  it("defines measurement and tracking for every supported objective", () => {
    expect(Object.values(OBJECTIVE_RULES)).toHaveLength(4);
    for (const rule of Object.values(OBJECTIVE_RULES)) {
      expect(rule.primaryMetric).toBeTruthy();
      expect(rule.secondaryMetrics.length).toBeGreaterThan(0);
      expect(rule.trackingRequirements.length).toBeGreaterThan(0);
    }
  });
});
