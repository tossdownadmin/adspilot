import type { AuditEvent, CampaignBrief, CampaignProposal, Finding, Workspace } from "./domain";
import { decideCampaignPlan, findUnsupportedCategory, OBJECTIVE_RULES, type CreativeAngle } from "./campaign-rules";

const createId = (prefix: string) => `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;

export function validateProposal(brief: CampaignBrief, workspace: Workspace): Finding[] {
  const findings: Finding[] = [];
  if (brief.dailyBudget > workspace.maxDailyBudget) {
    findings.push({
      code: "BUDGET_DAILY_LIMIT_EXCEEDED",
      severity: "blocker",
      title: "Daily budget exceeds policy",
      message: `Requested ${brief.currency} ${brief.dailyBudget.toLocaleString()} per day; workspace limit is ${workspace.currency} ${workspace.maxDailyBudget.toLocaleString()}.`,
    });
  }
  if (brief.currency !== workspace.currency) {
    findings.push({
      code: "CURRENCY_MISMATCH",
      severity: "blocker",
      title: "Currency mismatch",
      message: `The connected account uses ${workspace.currency}; this brief uses ${brief.currency}.`,
    });
  }
  if (!brief.audienceHint.trim()) {
    findings.push({
      code: "AUDIENCE_ASSUMED",
      severity: "warning",
      title: "Audience inferred by AI",
      message: "No audience hypothesis was supplied. Review the inferred audience before approval.",
    });
  }
  if (!brief.destinationUrl.startsWith("https://")) {
    findings.push({
      code: "DESTINATION_NOT_HTTPS",
      severity: "warning",
      title: "Destination is not HTTPS",
      message: "Use an HTTPS landing page before a real campaign launch.",
    });
  }
  if (brief.dailyBudget < 10) {
    findings.push({
      code: "BUDGET_TOO_LOW_FOR_TESTING",
      severity: "warning",
      title: "Very limited testing budget",
      message: `${brief.currency} ${brief.dailyBudget} per day may not generate enough delivery data to compare creative messages reliably.`,
    });
  }
  if (brief.durationDays < 7) {
    findings.push({
      code: "SHORT_TEST_DURATION",
      severity: "warning",
      title: "Short evaluation window",
      message: "Campaigns shorter than seven days may be difficult to evaluate because delivery and conversion reporting need time to stabilize.",
    });
  }
  const unsupportedCategory = findUnsupportedCategory(`${workspace.category} ${brief.productName} ${brief.offerDescription} ${brief.extraInstructions}`);
  if (unsupportedCategory) {
    findings.push({
      code: "UNSUPPORTED_SENSITIVE_CATEGORY",
      severity: "blocker",
      title: "Unsupported campaign category",
      message: `${unsupportedCategory.charAt(0).toUpperCase()}${unsupportedCategory.slice(1)} campaigns require provider-specific compliance handling that is not available in this prototype.`,
    });
  }
  findings.push({
    code: "SIMULATION_MODE",
    severity: "info",
    title: "Simulation mode",
    message: "Approval creates paused simulated objects and cannot spend real money.",
  });
  return findings;
}

function buildAd(angle: CreativeAngle, brief: CampaignBrief, callToAction: string, voice: string) {
  const variants: Record<CreativeAngle, Omit<CampaignProposal["ads"][number], "id">> = {
    PRIMARY_BENEFIT: {
      headline: `A smarter way to choose ${brief.productName}`,
      primaryText: `${brief.offerDescription} Discover why ${brief.businessName} is built for people who expect more.`,
      callToAction,
      creativeBrief: `Clean product-led visual. Show ${brief.productName} in context, lead with the primary benefit, and use a ${voice} tone.`,
    },
    PROBLEM_FRICTION: {
      headline: `${brief.productName}, without the guesswork`,
      primaryText: `Still comparing options? ${brief.businessName} makes the next step simple. ${brief.offerDescription}`,
      callToAction,
      creativeBrief: "Problem-to-solution sequence. Show the friction first, resolve it visually, and end with one clear next step.",
    },
    USE_CASE: {
      headline: `Meet your next ${brief.productName}`,
      primaryText: `Designed for the moments that matter—not more noise. Explore ${brief.productName} from ${brief.businessName} today.`,
      callToAction,
      creativeBrief: "Human-centered use-case scene with the product benefit visible in the first frame and minimal overlay text.",
    },
    PROOF_CONFIDENCE: {
      headline: `See what sets ${brief.productName} apart`,
      primaryText: `${brief.offerDescription} Take a closer look at the details behind ${brief.businessName}.`,
      callToAction,
      creativeBrief: "Proof-led demonstration using only verifiable product details from the landing page. Do not invent ratings, statistics, or testimonials.",
    },
  };
  return { id: createId("ad"), ...variants[angle] };
}

export function generateProposal(brief: CampaignBrief, workspace: Workspace): CampaignProposal {
  const now = new Date();
  const objectiveRule = OBJECTIVE_RULES[brief.objective];
  const plan = decideCampaignPlan(brief);
  const findings = validateProposal(brief, workspace);
  const voice = brief.brandVoice.trim() || "clear, confident, and practical";
  const audience = brief.audienceHint.trim() || `People in ${brief.geography} actively exploring solutions related to ${brief.productName}`;
  const campaignName = `${brief.businessName} | ${brief.productName} | ${brief.objective} | ${now.toISOString().slice(0, 10)}`;
  const status = findings.some((finding) => finding.severity === "blocker") ? "VALIDATION_BLOCKED" : "READY_FOR_APPROVAL";

  return {
    id: createId("prop"),
    revision: 1,
    schemaVersion: "1.0",
    createdAt: now.toISOString(),
    status,
    brief,
    campaignName,
    rationale: `${plan.structureReason} The ${brief.dailyBudget.toLocaleString()} ${brief.currency} daily budget stays concentrated rather than fragmented.`,
    plan: {
      budgetTier: plan.budgetTier,
      structure: plan.structure,
      creativeAngles: plan.creativeAngles,
      structureReason: plan.structureReason,
    },
    objective: brief.objective,
    budget: { daily: brief.dailyBudget, lifetime: brief.dailyBudget * brief.durationDays, currency: brief.currency },
    schedule: { startDate: now.toISOString().slice(0, 10), durationDays: brief.durationDays },
    audience: {
      summary: audience,
      geography: brief.geography,
      ageRange: "25–54",
      signals: ["Problem-aware shoppers", "Recent category engagement", "High-intent landing page visitors"],
    },
    placements: ["Facebook Feed", "Instagram Feed", "Instagram Stories", "Instagram Reels"],
    optimizationGoal: objectiveRule.optimizationGoal,
    ads: plan.creativeAngles.map((angle) => buildAd(angle, brief, objectiveRule.callToAction, voice)),
    measurement: {
      primaryMetric: objectiveRule.primaryMetric,
      secondaryMetrics: objectiveRule.secondaryMetrics,
      trackingRequirements: objectiveRule.trackingRequirements,
    },
    assumptions: [
      "The destination page accurately reflects the advertised offer.",
      "The business owns or has permission to use all supplied creative assets.",
      `The target audience can be served in ${brief.geography}.`,
    ],
    findings,
  };
}

export function approveProposal(proposal: CampaignProposal): CampaignProposal {
  if (proposal.findings.some((finding) => finding.severity === "blocker")) {
    throw new Error("Resolve all policy blockers before approval.");
  }
  const payloadHash = `sha256:${proposal.id.slice(-8)}${proposal.revision.toString().padStart(4, "0")}`;
  return { ...proposal, status: "APPROVED", approval: { approvedAt: new Date().toISOString(), payloadHash } };
}

export function executeProposal(proposal: CampaignProposal): CampaignProposal {
  if (proposal.status !== "APPROVED" || !proposal.approval) throw new Error("A valid approval is required.");
  const seed = proposal.id.slice(-7).toUpperCase();
  return {
    ...proposal,
    status: "LAUNCHED_PAUSED",
    execution: {
      executedAt: new Date().toISOString(),
      campaignId: `cmp_${seed}`,
      adSetId: `set_${seed}`,
      adIds: proposal.ads.map((_, index) => `ad_${seed}${index + 1}`),
      requestId: createId("req"),
    },
  };
}

export function audit(action: string, detail: string, status: AuditEvent["status"] = "success", entityId?: string): AuditEvent {
  return { id: createId("evt"), createdAt: new Date().toISOString(), action, detail, status, entityId };
}
