import type { CampaignBrief, Objective } from "./domain";
import { loadBrain } from "./brain/load-brain";

export type BudgetTier = "LEAN" | "VALIDATION" | "SCALE_READY";
export type CreativeAngle = "PRIMARY_BENEFIT" | "PROBLEM_FRICTION" | "USE_CASE" | "PROOF_CONFIDENCE";

export type ObjectiveRule = {
  optimizationGoal: string;
  primaryMetric: string;
  secondaryMetrics: string[];
  trackingRequirements: string[];
  callToAction: string;
};

export type PlanningDecision = {
  budgetTier: BudgetTier;
  structure: "ONE_PROSPECTING_AD_SET";
  adCount: number;
  creativeAngles: CreativeAngle[];
  structureReason: string;
};

const objectiveRules = loadBrain().brain.objectiveRules;
export const OBJECTIVE_RULES: Record<Objective, ObjectiveRule> = Object.fromEntries(
  Object.entries(objectiveRules.objectiveRules).map(([objective, rule]) => [objective.toUpperCase(), rule]),
) as Record<Objective, ObjectiveRule>;
const tierAngles = objectiveRules.tierCreativeAngles as Record<BudgetTier, CreativeAngle[]>;

export function getBudgetTier(dailyBudget: number): BudgetTier {
  return objectiveRules.budgetTiers.find((rule) => rule.maxDailyBudgetExclusive === null || dailyBudget < rule.maxDailyBudgetExclusive)?.tier ?? "SCALE_READY";
}

export function decideCampaignPlan(brief: Pick<CampaignBrief, "dailyBudget">): PlanningDecision {
  const budgetTier = getBudgetTier(brief.dailyBudget);
  const creativeAngles = tierAngles[budgetTier];
  return {
    budgetTier,
    structure: objectiveRules.structure,
    adCount: creativeAngles.length,
    creativeAngles,
    structureReason: budgetTier === "LEAN"
      ? "Keep limited delivery data concentrated in one audience and two meaningfully different messages."
      : budgetTier === "VALIDATION"
        ? "Concentrate spend in one audience while testing benefit, friction, and use-case messages."
        : "Keep a stable prospecting audience and add a proof-focused challenger without fragmenting delivery.",
  };
}

export const UNSUPPORTED_CATEGORY_PATTERNS = objectiveRules.unsupportedCategories;

export function findUnsupportedCategory(text: string): string | undefined {
  return UNSUPPORTED_CATEGORY_PATTERNS.find(({ pattern }) => pattern.test(text))?.category;
}
