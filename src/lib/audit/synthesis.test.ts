import { afterEach, describe, expect, it } from "vitest";
import { synthesizeAuditBatches } from "./synthesis";

const initialKey = process.env.OPENAI_API_KEY;

afterEach(() => {
  if (initialKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = initialKey;
});

describe("batched audit synthesis", () => {
  it("returns deterministic section fallbacks when the LLM is unavailable", async () => {
    delete process.env.OPENAI_API_KEY;
    const sections = await synthesizeAuditBatches({
      accountId: "12345", summary: { campaigns: 2, significant: 2, spend: 100, working: 1 },
      winners: [], losers: [], creatives: [],
    });
    expect(sections.summary).toContain("1 active campaigns");
    expect(sections.winners).toContain("No evidence-qualified");
    expect(sections.creatives).toContain("did not return creative rows");
  });
});
