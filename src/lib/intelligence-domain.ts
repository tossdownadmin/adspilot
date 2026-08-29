export type IntelligenceObjective = "sales" | "leads" | "traffic" | "awareness";
export type Jtd = "acquire_new" | "first_order" | "reactivate_lapsed" | "promote_lto" | "drive_catering" | "lift_aov" | "new_location_awareness" | "loyalty_signup" | "unknown";
export type PerformanceTier = "winner" | "contender" | "underperformer" | "kill_candidate" | "insufficient_data";
export type DimensionSource = "meta_returned" | "inferred_from_campaign_name" | "not_enough_data";

export type HistoricalCampaign = {
  campaignId: string;
  name: string;
  region: string;
  product: string;
  objective: IntelligenceObjective;
  jtd: Jtd;
  jtdConfidence: number;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  landingPageViews: number;
  conversions: number;
  revenue: number;
  daysActive: number;
  dailySpend: number;
  trackingQuality: "good" | "warning" | "critical";
  ageDays: number;
  creativePattern: string;
  audiencePattern: string;
  offerPattern: string;
  creativeFormat?: string;
  regionSource?: DimensionSource;
  productSource?: DimensionSource;
  creativeFormatSource?: DimensionSource;
};

export type DerivedMetrics = {
  ctr: number | null;
  lpvRate: number | null;
  cvr: number | null;
  cpa: number | null;
  roas: number | null;
  frequency: number | null;
  costPerLpv: number | null;
  costPerThousandReached: number | null;
};

export type MetricContribution = {
  metric: string;
  rawValue: number;
  normalizedScore: number;
  weight: number;
  contribution: number;
  direction: "higher" | "lower";
};

export type AuditResult = {
  campaign: HistoricalCampaign;
  metrics: DerivedMetrics;
  significant: boolean;
  gateFailures: string[];
  cohortKey: string;
  cohortSize: number;
  score: number | null;
  tier: PerformanceTier;
  contributions: MetricContribution[];
  eligibleReference: boolean;
  nuanceFlags: string[];
  rationale: string;
};

export type NewCampaignBrief = {
  region: string;
  product: string;
  objective: IntelligenceObjective;
  jtd: Jtd;
  dailyBudget: number;
  offer: string;
};

export type ReferenceSelection = {
  result: AuditResult;
  matchedRung: string[];
  candidateCount: number;
};

export type IntelligencePlaybook = {
  schemaVersion: "1.0";
  playbookId: string;
  recommendationMode: "historical_blend" | "single_reference" | "cold_start";
  brief: NewCampaignBrief;
  references: {
    closestBest: ReferenceSelection | null;
    overallBest: ReferenceSelection | null;
    referencesAreSame: boolean;
  };
  config: {
    objective: IntelligenceObjective;
    optimizationGoal: string;
    bidStrategy: string;
    dailyBudget: number;
    initialStatus: "PAUSED";
    audience: { geo: string; pattern: string };
    offerGuidance: string;
    creativeAngle: string;
    primaryTextGuidance: string;
  };
  provenance: Record<string, { source: string; campaignId?: string; transformation: string }>;
  evidence: Array<{ claim: string; campaignId: string; metric: string; value: number }>;
  confidence: number;
  warnings: string[];
  reviewRequired: true;
};
