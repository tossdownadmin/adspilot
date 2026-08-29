import type { AccountDiagnosis, AuditResult, DerivedMetrics, HistoricalCampaign, IntelligenceObjective, IntelligencePlaybook, Jtd, MetricContribution, NewCampaignBrief, ReferenceSelection } from "./intelligence-domain";
import { loadBrain } from "./brain/load-brain";

type MetricRule = { key: keyof DerivedMetrics | "conversions"; weight: number; direction: "higher" | "lower" };
const brain = loadBrain().brain;
const metricRules = brain.scoring.metricRules as Record<IntelligenceObjective, MetricRule[]>;

const div = (a: number, b: number) => b > 0 ? a / b : null;
const round = (value: number, places = 3) => Number(value.toFixed(places));

export function deriveMetrics(campaign: HistoricalCampaign): DerivedMetrics {
  return {
    ctr: div(campaign.clicks, campaign.impressions), lpvRate: div(campaign.landingPageViews, campaign.clicks),
    cvr: div(campaign.conversions, campaign.landingPageViews || campaign.clicks), cpa: div(campaign.spend, campaign.conversions),
    roas: div(campaign.revenue, campaign.spend), frequency: div(campaign.impressions, campaign.reach),
    costPerLpv: div(campaign.spend, campaign.landingPageViews), costPerThousandReached: campaign.reach > 0 ? campaign.spend / campaign.reach * 1000 : null,
  };
}

export function significanceFailures(c: HistoricalCampaign): string[] {
  const failures: string[] = [];
  const require = (condition: boolean, code: string) => { if (!condition) failures.push(code); };
  const gate = brain.significance.gates[c.objective];
  require(c.spend >= gate.minSpend, `min_spend_${gate.minSpend}`);
  if (gate.minImpressions !== undefined) require(c.impressions >= gate.minImpressions, `min_impressions_${gate.minImpressions}`);
  if (gate.minConversions !== undefined) require(c.conversions >= gate.minConversions, c.objective === "sales" ? `min_purchases_${gate.minConversions}` : `min_leads_${gate.minConversions}`);
  if (gate.minLandingPageViews !== undefined) require(c.landingPageViews >= gate.minLandingPageViews, `min_lpv_${gate.minLandingPageViews}`);
  if (gate.minReach !== undefined) require(c.reach >= gate.minReach, `min_reach_${gate.minReach}`);
  require(c.daysActive >= gate.minDaysActive, `min_days_${gate.minDaysActive}`);
  return failures;
}

const valueFor = (c: HistoricalCampaign, m: DerivedMetrics, key: MetricRule["key"]) => key === "conversions" ? (c.objective === "traffic" ? c.landingPageViews : c.conversions) : m[key];

function median(values: number[]) { const sorted = [...values].sort((a,b) => a-b); const mid = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2; }

export function auditCampaigns(campaigns: HistoricalCampaign[]): AuditResult[] {
  const prepared = campaigns.map((campaign) => ({ campaign, metrics: deriveMetrics(campaign), gateFailures: significanceFailures(campaign) }));
  return prepared.map((item) => {
    const specificCohort = prepared.filter((peer) => peer.campaign.objective === item.campaign.objective && peer.campaign.jtd === item.campaign.jtd && peer.gateFailures.length === 0);
    const objectiveCohort = prepared.filter((peer) => peer.campaign.objective === item.campaign.objective && peer.gateFailures.length === 0);
    const useObjectiveFallback = brain.scoring.cohort.fallbackToObjective && specificCohort.length < brain.scoring.cohort.minForRelativeScoring;
    const cohort = useObjectiveFallback ? objectiveCohort : specificCohort;
    const cohortKey = useObjectiveFallback ? `${item.campaign.objective}:all` : `${item.campaign.objective}:${item.campaign.jtd}`;
    if (item.gateFailures.length) return { ...item, significant: false, cohortKey, cohortSize: cohort.length, score: null, tier: "insufficient_data", contributions: [], eligibleReference: false, nuanceFlags: [], rationale: `Insufficient evidence: ${item.gateFailures.join(", ").replaceAll("_", " ")}.` };
    const contributions: MetricContribution[] = metricRules[item.campaign.objective].map((rule) => {
      const rawValue = valueFor(item.campaign, item.metrics, rule.key) ?? 0;
      const values = cohort.map((peer) => valueFor(peer.campaign, peer.metrics, rule.key)).filter((value): value is number => value !== null);
      const min = Math.min(...values), max = Math.max(...values);
      const normalized = max === min ? brain.scoring.normalization.tieValue : (rawValue - min) / (max - min);
      const normalizedScore = rule.direction === "lower" ? 1 - normalized : normalized;
      return { metric: String(rule.key), rawValue: round(rawValue), normalizedScore: round(normalizedScore), weight: rule.weight, contribution: round(normalizedScore * rule.weight), direction: rule.direction };
    });
    const score = round(contributions.reduce((sum, metric) => sum + metric.contribution, 0));
    const costKey = item.campaign.objective === "traffic" ? "costPerLpv" : item.campaign.objective === "awareness" ? "costPerThousandReached" : "cpa";
    const costs = cohort.map((peer) => peer.metrics[costKey]).filter((v): v is number => v !== null);
    const medianCost = median(costs);
    const ownCost = item.metrics[costKey] ?? Infinity;
    const salesGuard = item.campaign.objective !== "sales" || (item.metrics.roas ?? 0) >= median(cohort.map((peer) => peer.metrics.roas ?? 0)) * brain.scoring.guards.salesRoasMultiplier;
    const costGuard = item.campaign.objective === "sales" ? salesGuard : ownCost <= medianCost * brain.scoring.guards.costGuardMultiplier;
    const thresholds = brain.scoring.tierThresholds;
    const minCohort = brain.scoring.cohort.minForRelativeScoring;
    let tier: AuditResult["tier"] = score >= thresholds.winner && costGuard && item.campaign.trackingQuality !== "critical" ? "winner" : score >= thresholds.contender ? "contender" : score >= thresholds.underperformer ? "underperformer" : "kill_candidate";
    if (ownCost > medianCost * brain.scoring.guards.killCostMultiplier && cohort.length >= minCohort) tier = "kill_candidate";
    if (cohort.length < minCohort && tier === "winner") tier = "contender";
    if (cohort.length < minCohort && tier === "kill_candidate") tier = "underperformer";
    const nuanceFlags: string[] = [];
    if (item.campaign.trackingQuality === "critical") nuanceFlags.push("tracking_gap");
    if (item.metrics.frequency && item.metrics.frequency > brain.scoring.nuance.frequencySaturationThreshold) nuanceFlags.push("audience_saturation");
    if (cohort.length < minCohort) nuanceFlags.push("small_cohort");
    const eligibility = brain.retrieval.eligibility;
    const jtdEligible = brain.jtd.jobs.find((job) => job.id === item.campaign.jtd)?.referenceEligible ?? false;
    const eligibleReference = tier === eligibility.requireTier && cohort.length >= eligibility.minCohort && item.campaign.jtdConfidence >= eligibility.minJtdConfidence && item.campaign.trackingQuality === eligibility.requireTrackingQuality && item.campaign.ageDays <= eligibility.maxAgeDays && jtdEligible;
    const strongest = [...contributions].sort((a,b) => b.contribution - a.contribution)[0];
    return { ...item, significant: true, cohortKey, cohortSize: cohort.length, score, tier, contributions, eligibleReference, nuanceFlags, rationale: `${item.campaign.campaignId} scored ${score.toFixed(2)} in ${cohortKey}; ${strongest.metric} contributed ${strongest.contribution.toFixed(3)}.` };
  });
}

export function buildAccountDiagnosis(results: AuditResult[]): AccountDiagnosis {
  const significant = results.filter((result) => result.significant && result.score !== null);
  const totalSpend = results.reduce((sum, result) => sum + result.campaign.spend, 0);
  const scoredSpend = significant.reduce((sum, result) => sum + result.campaign.spend, 0);
  const concentrationCount = brain.scoring.diagnosis.concentrationCampaignCount;
  const topSpend = [...results].sort((left, right) => right.campaign.spend - left.campaign.spend).slice(0, concentrationCount).reduce((sum, result) => sum + result.campaign.spend, 0);
  const topSpendShare = totalSpend > 0 ? round(topSpend / totalSpend) : 0;
  const knownJtdCampaigns = results.filter((result) => result.campaign.jtd !== "unknown").length;
  const knownJtdShare = results.length ? round(knownJtdCampaigns / results.length) : 0;
  const bestByObjective: AccountDiagnosis["bestByObjective"] = {};
  for (const objective of ["sales", "leads", "traffic", "awareness"] as IntelligenceObjective[]) {
    const ranked = significant.filter((result) => result.campaign.objective === objective).sort((left, right) => (right.score ?? 0) - (left.score ?? 0));
    if (!ranked.length) continue;
    bestByObjective[objective] = ranked.slice(0, brain.scoring.diagnosis.topPerObjective).map((result) => {
      const strongest = [...result.contributions].sort((left, right) => right.contribution - left.contribution)[0];
      return { campaignId: result.campaign.campaignId, name: result.campaign.name, tier: result.tier, score: result.score ?? 0, spend: result.campaign.spend, winningMetric: strongest?.metric ?? "not_enough_data", winningMetricValue: strongest?.rawValue ?? null };
    });
  }
  const wasteCandidates = significant
    .filter((result) => result.tier === "kill_candidate" || result.tier === "underperformer")
    .sort((left, right) => right.campaign.spend - left.campaign.spend)
    .slice(0, brain.scoring.diagnosis.wasteLimit)
    .map((result) => ({ campaignId: result.campaign.campaignId, name: result.campaign.name, tier: result.tier, spend: result.campaign.spend, reason: result.nuanceFlags.includes("audience_saturation") ? "High frequency and weak relative performance" : `Bottom-tier ${result.campaign.objective} performance versus comparable campaigns` }));
  const dimensionLeaders = {
    region: rankDiagnosisDimension(significant, "region"),
    product: rankDiagnosisDimension(significant, "product"),
    jtd: rankDiagnosisDimension(significant, "jtd"),
  };
  return { summary: { campaigns: results.length, significantCampaigns: significant.length, totalSpend: round(totalSpend, 2), scoredSpend: round(scoredSpend, 2), topSpendShare, spendConcentrated: topSpendShare >= brain.scoring.diagnosis.highConcentrationShare, knownJtdCampaigns, knownJtdShare }, bestByObjective, wasteCandidates, dimensionLeaders };
}

function rankDiagnosisDimension(results: AuditResult[], key: "region" | "product" | "jtd") {
  const groups = new Map<string, { value: string; campaigns: number; spend: number; scoreTotal: number; winners: number }>();
  for (const result of results) {
    const value = String(result.campaign[key] || "unknown");
    if (value === "Unknown" || value === "unknown" || value === "Not enough data") continue;
    const group = groups.get(value) ?? { value, campaigns: 0, spend: 0, scoreTotal: 0, winners: 0 };
    group.campaigns += 1; group.spend += result.campaign.spend; group.scoreTotal += result.score ?? 0;
    if (result.tier === "winner") group.winners += 1;
    groups.set(value, group);
  }
  return [...groups.values()].map((group) => ({ value: group.value, campaigns: group.campaigns, spend: round(group.spend, 2), averageScore: round(group.scoreTotal / group.campaigns), winners: group.winners })).sort((left, right) => right.averageScore - left.averageScore || right.spend - left.spend).slice(0, 5);
}

const ladder = brain.retrieval.closestBestLadder as Array<Array<"region" | "product" | "jtd" | "objective">>;
const matches = (r: AuditResult, b: NewCampaignBrief, keys: typeof ladder[number]) => keys.every((key) => r.campaign[key] === b[key]);

export function retrieveReferences(results: AuditResult[], brief: NewCampaignBrief) {
  const pool = results.filter((r) => r.eligibleReference);
  let closestBest: ReferenceSelection | null = null;
  for (const rung of ladder) {
    const candidates = pool.filter((r) => matches(r, brief, rung)).sort((a,b) => (b.score ?? 0) - (a.score ?? 0));
    if (candidates.length) { closestBest = { result: candidates[0], matchedRung: rung, candidateCount: candidates.length }; break; }
  }
  const overallKeys = brain.retrieval.overallBestKeys as Array<"region" | "product" | "jtd" | "objective">;
  const overall = pool.filter((r) => matches(r, brief, overallKeys)).sort((a,b) => (b.score ?? 0) - (a.score ?? 0));
  const overallBest = overall.length ? { result: overall[0], matchedRung: overallKeys, candidateCount: overall.length } : null;
  return { closestBest, overallBest, referencesAreSame: Boolean(closestBest && overallBest && closestBest.result.campaign.campaignId === overallBest.result.campaign.campaignId) };
}

export function buildIntelligencePlaybook(results: AuditResult[], brief: NewCampaignBrief, workspaceLimit = brain.retrieval.budgetFormula.workspaceDailyCap): IntelligencePlaybook {
  const references = retrieveReferences(results, brief);
  const source = references.closestBest ?? references.overallBest;
  const mode = references.closestBest && references.overallBest ? (references.referencesAreSame ? "single_reference" : "historical_blend") : source ? "single_reference" : "cold_start";
  const effectiveLimit = Math.min(workspaceLimit, brain.retrieval.budgetFormula.workspaceDailyCap);
  const historicBudget = source ? Math.min(source.result.campaign.dailySpend * brain.retrieval.budgetFormula.fromClosestBestDailySpendFraction, effectiveLimit) : Math.min(brief.dailyBudget, effectiveLimit);
  const dailyBudget = Math.min(brain.retrieval.budgetFormula.preserveValidUserBudget ? brief.dailyBudget || historicBudget : historicBudget, effectiveLimit);
  const closest = references.closestBest?.result.campaign;
  const overall = references.overallBest?.result.campaign;
  const confidenceRule = brain.retrieval.confidence;
  const confidence = mode === "cold_start" ? confidenceRule.coldStart : round(Math.max(confidenceRule.min, Math.min(confidenceRule.max, ((references.closestBest?.result.score ?? confidenceRule.min) + (references.overallBest?.result.score ?? confidenceRule.min)) / 2 - (references.referencesAreSame ? confidenceRule.duplicateReferencePenalty : 0))), 2);
  const playbook: IntelligencePlaybook = {
    schemaVersion: "1.0", playbookId: `pb_${crypto.randomUUID().slice(0,8)}`, recommendationMode: mode, brief, references,
    config: { objective: brief.objective, optimizationGoal: brain.retrieval.optimizationGoalMap[brief.objective], bidStrategy: brain.retrieval.bidStrategy, dailyBudget, initialStatus: brain.retrieval.initialStatus, audience: { geo: brief.region, pattern: closest?.audiencePattern ?? "broad prospecting" }, offerGuidance: brief.offer || closest?.offerPattern || "Use the verified current offer", creativeAngle: overall?.creativePattern ?? closest?.creativePattern ?? "primary benefit", primaryTextGuidance: `Lead with the verified ${brief.offer || "product benefit"}; adapt the ${overall?.creativePattern ?? "primary benefit"} pattern without copying unsupported claims.` },
    provenance: {
      "config.objective": { source: "user_brief", transformation: "none" }, "config.optimizationGoal": { source: "objective_rule", transformation: "objective_mapping" },
      "config.dailyBudget": { source: "workspace_policy", transformation: "user_budget_capped" }, "config.audience.geo": { source: "user_brief", transformation: "none" },
      "config.audience.pattern": { source: closest ? "closest_best" : "cold_start_rule", campaignId: closest?.campaignId, transformation: "pattern_generalized" },
      "config.creativeAngle": { source: overall ? "overall_best" : closest ? "closest_best" : "cold_start_rule", campaignId: overall?.campaignId ?? closest?.campaignId, transformation: "pattern_generalized" },
    },
    evidence: [references.closestBest, references.overallBest].filter((r): r is ReferenceSelection => Boolean(r)).map((r) => ({ claim: `${r.result.campaign.name} supports the recommended pattern.`, campaignId: r.result.campaign.campaignId, metric: "composite_score", value: r.result.score ?? 0 })),
    confidence, warnings: [], reviewRequired: true,
  };
  if (mode === "cold_start") playbook.warnings.push("No eligible historical winner was found; cold-start rules were used.");
  if (references.referencesAreSame) playbook.warnings.push("Closest best and overall best are the same campaign; evidence diversity is limited.");
  if (dailyBudget !== brief.dailyBudget) playbook.warnings.push(`Requested budget was capped at ${dailyBudget} by workspace policy.`);
  return playbook;
}

export function tierCounts(results: AuditResult[]) {
  return results.reduce<Record<string, number>>((counts, result) => ({ ...counts, [result.tier]: (counts[result.tier] ?? 0) + 1 }), {});
}

export const jtdLabel = (jtd: Jtd) => brain.jtd.jobs.find((job) => job.id === jtd)?.label ?? jtd.split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
