import type { AuditReport } from "./job-store";

type SynthesisSection = "summary" | "winners" | "losers" | "creatives" | "trends";

const headings: Record<SynthesisSection, string> = {
  summary: "Account summary", winners: "What is working", losers: "What needs attention", creatives: "Creative findings", trends: "Trend and saturation findings",
};

function fallback(section: SynthesisSection, report: AuditReport) {
  if (section === "summary") return `${report.summary?.working ?? 0} active campaigns clear the absolute health rules; ${report.winners?.length ?? 0} are best-in-class scale candidates and ${report.losers?.length ?? 0} require stop/rebuild review.`;
  if (section === "winners") return report.winners?.length ? report.winners.map((row) => `- **${row.name}** — ${row.verdict.label}: ${row.verdict.reason}`).join("\n") : "No evidence-qualified scale candidate was found.";
  if (section === "losers") return report.losers?.length ? report.losers.map((row) => `- **${row.name}** — ${row.verdict.label}: ${row.verdict.reason}`).join("\n") : "No active stop/rebuild candidate was found.";
  if (section === "creatives") return report.creatives?.length ? `${report.creatives.length} ad/creative rows were returned for focused review. Use the creative cards and objective metrics below.` : "Meta did not return creative rows for the focused campaigns.";
  return report.trends ? "Meta returned trend evidence for the reviewed entities; interpret direction as diagnostic evidence, not causality." : "Trend evidence was unavailable for this run.";
}

async function synthesizeSection(section: SynthesisSection, report: AuditReport) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return fallback(section, report);
  const slice = section === "summary" ? { summary: report.summary, campaigns: report.campaigns?.slice(0, 12) }
    : section === "winners" ? { winners: report.winners, adSets: report.adSets?.slice(0, 20) }
      : section === "losers" ? { losers: report.losers, adSets: report.adSets?.slice(0, 20) }
        : section === "creatives" ? { creatives: report.creatives?.slice(0, 30), creativeAssets: report.creativeAssets }
          : { trends: report.trends, campaigns: report.campaigns?.filter((row) => row.verdict.action === "REFRESH").slice(0, 12) };
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL?.trim() || "gpt-5", store: false, reasoning: { effort: "low" }, max_output_tokens: 1_200,
        instructions: `You are AdPilot. Write only the ${headings[section]} section from the supplied live evidence. Keep it concise and specific. Do not invent metrics, causal impact, or actions that conflict with deterministic verdicts. Paused entities are reference-only.`,
        input: JSON.stringify(slice),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    const payload = await response.json().catch(() => null) as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> } | null;
    if (!response.ok || !payload) return fallback(section, report);
    return payload.output_text || payload.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("\n") || fallback(section, report);
  } catch {
    return fallback(section, report);
  }
}

export async function synthesizeAuditBatches(report: AuditReport) {
  const sections: SynthesisSection[] = ["summary", "winners", "losers", "creatives", "trends"];
  const values = await Promise.all(sections.map(async (section) => [section, await synthesizeSection(section, report)] as const));
  return Object.fromEntries(values) as Record<SynthesisSection, string>;
}
