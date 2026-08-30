import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const objectiveKeys = ["sales", "leads", "traffic", "awareness"] as const;
const metricKeys = ["ctr", "lpvRate", "cvr", "cpa", "roas", "frequency", "costPerLpv", "costPerThousandReached", "conversions"] as const;
const jtdKeys = ["acquire_new", "first_order", "reactivate_lapsed", "promote_lto", "drive_catering", "lift_aov", "new_location_awareness", "loyalty_signup", "unknown"] as const;
const referenceKeys = ["region", "product", "jtd", "objective"] as const;

const metricRuleSchema = z.object({ key: z.enum(metricKeys), weight: z.number().min(0).max(1), direction: z.enum(["higher", "lower"]) }).strict();
const scoringSchema = z.object({
  metricRules: z.object(Object.fromEntries(objectiveKeys.map((key) => [key, z.array(metricRuleSchema).min(1)])) as Record<typeof objectiveKeys[number], z.ZodArray<typeof metricRuleSchema>>).strict(),
  tierThresholds: z.object({ winner: z.number(), contender: z.number(), underperformer: z.number() }).strict(),
  guards: z.object({ salesRoasMultiplier: z.number().positive(), costGuardMultiplier: z.number().positive(), killCostMultiplier: z.number().positive() }).strict(),
  cohort: z.object({ minForRelativeScoring: z.number().int().positive(), fallbackToObjective: z.boolean() }).strict(),
  diagnosis: z.object({
    topPerObjective: z.number().int().positive(),
    wasteLimit: z.number().int().positive(),
    concentrationCampaignCount: z.number().int().positive(),
    highConcentrationShare: z.number().min(0).max(1),
  }).strict(),
  nuance: z.object({ frequencySaturationThreshold: z.number().positive() }).strict(),
  absoluteFloor: z.object({ sales: z.object({ roas: z.number().nonnegative(), maxCpa: z.number().positive() }).strict(), leads: z.object({ maxCpa: z.number().positive() }).strict(), traffic: z.object({ maxCpa: z.number().positive() }).strict(), awareness: z.object({ maxCostPerThousandReached: z.number().positive() }).strict() }).strict(),
  normalization: z.object({ method: z.literal("min_max"), tieValue: z.number().min(0).max(1) }).strict(),
}).strict();

const gateSchema = z.object({
  minSpend: z.number().nonnegative(), minImpressions: z.number().int().nonnegative().optional(), minConversions: z.number().int().nonnegative().optional(),
  minLandingPageViews: z.number().int().nonnegative().optional(), minReach: z.number().int().nonnegative().optional(), minDaysActive: z.number().int().nonnegative(),
}).strict();
const significanceSchema = z.object({
  defaultCurrency: z.string().length(3),
  gates: z.object(Object.fromEntries(objectiveKeys.map((key) => [key, gateSchema])) as Record<typeof objectiveKeys[number], typeof gateSchema>).strict(),
  currencyOverrides: z.record(z.string(), z.record(z.string(), gateSchema.partial())),
}).strict();

const objectiveRuleSchema = z.object({ optimizationGoal: z.string().min(1), primaryMetric: z.string().min(1), secondaryMetrics: z.array(z.string()), trackingRequirements: z.array(z.string()), callToAction: z.string().min(1) }).strict();
const budgetTierSchema = z.object({ tier: z.enum(["LEAN", "VALIDATION", "SCALE_READY"]), maxDailyBudgetExclusive: z.number().positive().nullable() }).strict();
const objectiveRulesSchema = z.object({
  objectiveRules: z.object(Object.fromEntries(objectiveKeys.map((key) => [key, objectiveRuleSchema])) as Record<typeof objectiveKeys[number], typeof objectiveRuleSchema>).strict(),
  budgetTiers: z.array(budgetTierSchema).length(3),
  tierCreativeAngles: z.object({ LEAN: z.array(z.string()), VALIDATION: z.array(z.string()), SCALE_READY: z.array(z.string()) }).strict(),
  structure: z.literal("ONE_PROSPECTING_AD_SET"),
  unsupportedCategories: z.array(z.object({ category: z.string().min(1), pattern: z.string().min(1), flags: z.string() }).strict()),
}).strict();

const jtdSchema = z.object({
  version: z.string().min(1),
  jobs: z.array(z.object({ id: z.enum(jtdKeys), label: z.string().min(1), referenceEligible: z.boolean() }).strict()).length(jtdKeys.length),
  extensionCandidates: z.array(z.string()),
}).strict();

const retrievalSchema = z.object({
  eligibility: z.object({ requireTier: z.literal("winner"), minCohort: z.number().int().positive(), minJtdConfidence: z.number().min(0).max(1), requireTrackingQuality: z.literal("good"), maxAgeDays: z.number().int().positive() }).strict(),
  closestBestLadder: z.array(z.array(z.enum(referenceKeys)).min(1)).min(1),
  overallBestKeys: z.array(z.enum(referenceKeys)).min(1),
  budgetFormula: z.object({ fromClosestBestDailySpendFraction: z.number().min(0).max(1), workspaceDailyCap: z.number().positive(), preserveValidUserBudget: z.boolean() }).strict(),
  optimizationGoalMap: z.object({ sales: z.string(), leads: z.string(), traffic: z.string(), awareness: z.string() }).strict(),
  bidStrategy: z.string().min(1), initialStatus: z.literal("PAUSED"),
  confidence: z.object({ coldStart: z.number(), min: z.number(), max: z.number(), duplicateReferencePenalty: z.number() }).strict(),
}).strict();

type RawObjectiveRules = z.infer<typeof objectiveRulesSchema>;
export type Brain = Readonly<{
  scoring: z.infer<typeof scoringSchema>;
  significance: z.infer<typeof significanceSchema>;
  objectiveRules: Omit<RawObjectiveRules, "unsupportedCategories"> & { unsupportedCategories: Array<{ category: string; pattern: RegExp }> };
  jtd: z.infer<typeof jtdSchema>;
  retrieval: z.infer<typeof retrievalSchema>;
}>;

export type LoadedBrain = { brain: Brain; brainProse: string };

const files = ["00-brain-contract.md", "01-scoring-and-tiers.md", "02-significance-gates.md", "03-objective-and-creative-rules.md", "04-jtd-taxonomy.md", "05-retrieval-and-playbook.md"] as const;
const jsonBlock = /```json\s*\n([\s\S]*?)\n```/;
let cached: LoadedBrain | undefined;

function defaultBrainDirectory() {
  return join(process.cwd(), "src", "brain");
}

function parseConfig<T>(fileName: string, markdown: string, schema: z.ZodType<T>): T {
  const match = markdown.match(jsonBlock);
  if (!match?.[1]) throw new Error(`AdPilot brain error in ${fileName}: missing fenced json block.`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1]);
  } catch (error) {
    throw new Error(`AdPilot brain error in ${fileName}: invalid JSON (${error instanceof Error ? error.message : "parse failed"}).`);
  }
  const validated = schema.safeParse(parsed);
  if (!validated.success) throw new Error(`AdPilot brain error in ${fileName}: ${validated.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  return validated.data;
}

function stripJson(markdown: string) {
  return markdown.replace(jsonBlock, "").trim();
}

function freezeDeep<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child);
  }
  return value;
}

function readBrain(brainDirectory: string): LoadedBrain {
  const markdown = Object.fromEntries(files.map((fileName) => {
    try {
      return [fileName, readFileSync(join(brainDirectory, fileName), "utf8")];
    } catch (error) {
      throw new Error(`AdPilot brain error: could not read ${fileName} (${error instanceof Error ? error.message : "read failed"}).`);
    }
  })) as Record<typeof files[number], string>;

  const rawObjectiveRules = parseConfig("03-objective-and-creative-rules.md", markdown["03-objective-and-creative-rules.md"], objectiveRulesSchema);
  const brain: Brain = freezeDeep({
    scoring: parseConfig("01-scoring-and-tiers.md", markdown["01-scoring-and-tiers.md"], scoringSchema),
    significance: parseConfig("02-significance-gates.md", markdown["02-significance-gates.md"], significanceSchema),
    objectiveRules: {
      ...rawObjectiveRules,
      unsupportedCategories: rawObjectiveRules.unsupportedCategories.map(({ category, pattern, flags }) => ({ category, pattern: new RegExp(pattern, flags) })),
    },
    jtd: parseConfig("04-jtd-taxonomy.md", markdown["04-jtd-taxonomy.md"], jtdSchema),
    retrieval: parseConfig("05-retrieval-and-playbook.md", markdown["05-retrieval-and-playbook.md"], retrievalSchema),
  });
  const brainProse = files.map((fileName) => stripJson(markdown[fileName])).join("\n\n");
  return Object.freeze({ brain, brainProse });
}

export function loadBrain(): LoadedBrain {
  cached ??= readBrain(defaultBrainDirectory());
  return cached;
}

export function reloadBrain(brainDirectory = defaultBrainDirectory()): LoadedBrain {
  const loaded = readBrain(brainDirectory);
  if (brainDirectory === defaultBrainDirectory()) cached = loaded;
  return loaded;
}
