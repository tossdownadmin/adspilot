import { describe, expect, it } from "vitest";
import { liveCampaignsToHistory } from "./live-intelligence";

describe("live campaign intelligence adapter", () => {
  it("maps Meta campaign evidence without fixture fallback", () => {
    const rows = liveCampaignsToHistory([
      {
        id: "1201",
        name: "TD | PB | Conversion | Woodbridge | 2-5-26",
        objective: "OUTCOME_SALES",
        spend: 1000,
        impressions: 100000,
        reach: 20000,
        clicks: 500,
        purchases: 100,
        purchaseValue: 5000,
        landingPageViews: 400,
      },
    ], { since: "2026-06-29", until: "2026-08-27" });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ campaignId: "1201", region: "Woodbridge", product: "Not enough data", objective: "sales", conversions: 100, revenue: 5000 });
    expect(rows[0]?.regionSource).toBe("inferred_from_campaign_name");
    expect(rows[0]?.productSource).toBe("not_enough_data");
    expect(rows[0]?.name).not.toContain("Demo");
  });
});
