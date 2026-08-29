import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadBrain, reloadBrain } from "./load-brain";

const brainFiles = ["00-brain-contract.md", "01-scoring-and-tiers.md", "02-significance-gates.md", "03-objective-and-creative-rules.md", "04-jtd-taxonomy.md", "05-retrieval-and-playbook.md"];

describe("AdPilot brain loader", () => {
  it("loads the previous hardcoded defaults and compiles category patterns", () => {
    const { brain, brainProse } = loadBrain();
    expect(brain.scoring.metricRules.sales).toEqual([
      { key: "roas", weight: 0.35, direction: "higher" }, { key: "cpa", weight: 0.25, direction: "lower" },
      { key: "cvr", weight: 0.15, direction: "higher" }, { key: "conversions", weight: 0.15, direction: "higher" }, { key: "ctr", weight: 0.1, direction: "higher" },
    ]);
    expect(brain.scoring.tierThresholds).toEqual({ winner: 0.75, contender: 0.55, underperformer: 0.3 });
    expect(brain.scoring.guards).toEqual({ salesRoasMultiplier: 1.2, costGuardMultiplier: 0.8, killCostMultiplier: 2 });
    expect(brain.scoring.cohort.minForRelativeScoring).toBe(5);
    expect(brain.scoring.nuance.frequencySaturationThreshold).toBe(2.1);
    expect(brain.scoring.normalization.tieValue).toBe(0.5);
    expect(brain.significance.gates.sales).toEqual({ minSpend: 100, minImpressions: 10000, minConversions: 15, minDaysActive: 5 });
    expect(brain.objectiveRules.budgetTiers.map((tier) => tier.maxDailyBudgetExclusive)).toEqual([50, 150, null]);
    expect(brain.objectiveRules.objectiveRules.awareness.optimizationGoal).toBe("Reach");
    expect(brain.objectiveRules.unsupportedCategories[0]?.pattern).toBeInstanceOf(RegExp);
    expect(brain.retrieval.eligibility).toEqual({ requireTier: "winner", minCohort: 5, minJtdConfidence: 0.8, requireTrackingQuality: "good", maxAgeDays: 90 });
    expect(brain.retrieval.budgetFormula).toEqual({ fromClosestBestDailySpendFraction: 0.5, workspaceDailyCap: 200, preserveValidUserBudget: true });
    expect(brain.retrieval.confidence).toEqual({ coldStart: 0.42, min: 0.5, max: 0.95, duplicateReferencePenalty: 0.08 });
    expect(Object.isFrozen(brain)).toBe(true);
    expect(brainProse).toContain("The deterministic engine");
    expect(brainProse).not.toContain('"metricRules":');
  });

  it("throws on malformed json instead of falling back", () => {
    const source = join(process.cwd(), "src", "brain");
    const malformed = mkdtempSync(join(tmpdir(), "adpilot-brain-"));
    for (const fileName of brainFiles) cpSync(join(source, fileName), join(malformed, fileName));
    const scoringPath = join(malformed, "01-scoring-and-tiers.md");
    writeFileSync(scoringPath, readFileSync(scoringPath, "utf8").replace('"winner": 0.75', '"winner": nope'), "utf8");
    expect(() => reloadBrain(malformed)).toThrow(/01-scoring-and-tiers\.md: invalid JSON/);
  });
});
