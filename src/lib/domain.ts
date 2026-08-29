import { z } from "zod";

export const ObjectiveSchema = z.enum(["SALES", "LEADS", "TRAFFIC", "AWARENESS"]);
export type Objective = z.infer<typeof ObjectiveSchema>;

export const CampaignBriefSchema = z.object({
  businessName: z.string().trim().min(2, "Enter a business name"),
  productName: z.string().trim().min(2, "Enter a product or offer"),
  offerDescription: z.string().trim().min(20, "Add at least 20 characters of context"),
  objective: ObjectiveSchema,
  destinationUrl: z.string().url("Enter a valid destination URL"),
  geography: z.string().trim().min(2, "Enter a target geography"),
  currency: z.string().length(3),
  dailyBudget: z.number().positive("Budget must be greater than zero"),
  durationDays: z.number().int().min(1).max(90),
  audienceHint: z.string(),
  brandVoice: z.string(),
  extraInstructions: z.string(),
});

export type CampaignBrief = z.infer<typeof CampaignBriefSchema>;

export type Finding = {
  code: string;
  severity: "blocker" | "warning" | "info";
  title: string;
  message: string;
};

export type AdVariant = {
  id: string;
  headline: string;
  primaryText: string;
  callToAction: string;
  creativeBrief: string;
};

export type CampaignProposal = {
  id: string;
  revision: number;
  schemaVersion: "1.0";
  createdAt: string;
  status: "PROPOSED" | "READY_FOR_APPROVAL" | "VALIDATION_BLOCKED" | "APPROVED" | "LAUNCHED_PAUSED";
  brief: CampaignBrief;
  campaignName: string;
  rationale: string;
  plan: {
    budgetTier: "LEAN" | "VALIDATION" | "SCALE_READY";
    structure: "ONE_PROSPECTING_AD_SET";
    creativeAngles: string[];
    structureReason: string;
  };
  objective: Objective;
  budget: { daily: number; lifetime: number; currency: string };
  schedule: { startDate: string; durationDays: number };
  audience: { summary: string; geography: string; ageRange: string; signals: string[] };
  placements: string[];
  optimizationGoal: string;
  ads: AdVariant[];
  measurement: { primaryMetric: string; secondaryMetrics: string[]; trackingRequirements: string[] };
  assumptions: string[];
  findings: Finding[];
  approval?: { approvedAt: string; payloadHash: string };
  execution?: { executedAt: string; campaignId: string; adSetId: string; adIds: string[]; requestId: string };
};

export type AuditEvent = {
  id: string;
  createdAt: string;
  action: string;
  detail: string;
  status: "success" | "warning" | "neutral";
  entityId?: string;
};

export type Workspace = {
  businessName: string;
  websiteUrl: string;
  category: string;
  currency: string;
  timezone: string;
  maxDailyBudget: number;
  connected: boolean;
};

export type AppState = {
  workspace: Workspace;
  proposals: CampaignProposal[];
  auditEvents: AuditEvent[];
};
