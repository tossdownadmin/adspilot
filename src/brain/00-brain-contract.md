# AdPilot Brain — Contract & Index

This folder is AdPilot's **externalized brain**. It replaces hardcoded constants in `src/lib/intelligence-engine.ts` and `src/lib/campaign-rules.ts` with editable, versioned knowledge that two consumers read:

- **The deterministic engine** reads the single fenced ` ```json ` block in each file. That block is the *canonical machine config*. The engine's arithmetic, gates, tiers, and retrieval are driven by these values — not by numbers baked into TypeScript.
- **The analyst LLM** reads the prose. The prose explains *why* each number exists and how to interpret results, and is concatenated into the agent's system context so its explanations stay grounded in the same rules the engine enforces.

## The invariant that keeps this safe

The LLM may **explain** anything in these files. The LLM may **never override** a value in a ` ```json ` block. Scores, tiers, gates, and budgets are computed deterministically from the config and are read-only to the model. This preserves the current architecture, where the model reasons and the code decides.

## Loader contract (what the engine expects)

1. On the server (Node runtime only — never Edge), read each `NN-*.md` file in this folder.
2. Extract the **first** fenced ` ```json ` block from each file.
3. `JSON.parse` it, then validate with a per-file **zod schema**. A file that fails validation is a hard startup error, not a silent fallback — a malformed brain must never degrade to guessed defaults.
4. Freeze the parsed config and expose it as typed objects the engine imports (replacing the old inline constants).
5. Concatenate the prose (everything outside the json block) into a single system-context string for the LLM.
6. Cache after first load; re-read only on explicit reload.

## Non-negotiable: values must match current code

Every default in these files is copied verbatim from the current implementation. After Codex wires the loader in, `npm run test` must pass **unchanged**. The win is not new behavior — it's that these values are now edited in markdown, per file, with a validation gate, instead of in compiled code.

## Files

| File | Replaces | Owns |
|---|---|---|
| `01-scoring-and-tiers.md` | `metricRules`, tier + guard logic in `intelligence-engine.ts` | Objective metric weights, tier cutoffs, cost/ROAS guards, kill rules, cohort rules, nuance flags, normalization |
| `02-significance-gates.md` | `significanceFailures()` | Per-objective evidence gates; currency/spend-tier override hooks |
| `03-objective-and-creative-rules.md` | `OBJECTIVE_RULES`, budget tiers, creative angles, unsupported categories in `campaign-rules.ts` | Objective→optimization mapping, tracking requirements, CTAs, budget tiers, creative angle sets, blocked-category patterns |
| `04-jtd-taxonomy.md` | the `Jtd` union + name inference | Job-to-be-done IDs, definitions, name-inference hints, extension slots |
| `05-retrieval-and-playbook.md` | `retrieveReferences()` + `buildIntelligencePlaybook()` constants | Eligibility rules, closest/overall ladder, budget formula, confidence formula |

## A known gap these files also fix

`campaign-rules.ts` today defines `OBJECTIVE_RULES` for **sales, leads, traffic only**, while the scoring engine also handles **awareness**. These files define awareness consistently across both. Codex should add the awareness entry when wiring `campaign-rules.ts` to the brain.
