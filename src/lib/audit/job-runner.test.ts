import { beforeEach, describe, expect, it } from "vitest";
import { clearAuditJobsForTests, createAuditJob, getAuditJob } from "./job-store";
import { runAuditStages, type AuditStage } from "./job-runner";

describe("audit job runner", () => {
  beforeEach(() => clearAuditJobsForTests());

  it("runs stages in order and continues after one fails", async () => {
    const order: string[] = [];
    const stages: AuditStage[] = [
      { name: "scope", label: "Scope", run: async () => { order.push("scope"); return { ok: true }; } },
      { name: "pull", label: "Pull", run: async () => { order.push("pull"); throw new Error("Meta unavailable"); } },
      { name: "score", label: "Score", run: async () => { order.push("score"); return { scored: true }; } },
    ];
    createAuditJob("job-1", "12345", stages.map((stage) => ({ stage: stage.name, label: stage.label, status: "pending" })));

    await runAuditStages("job-1", stages);

    expect(order).toEqual(["scope", "pull", "score"]);
    expect(getAuditJob("job-1")?.stages.map((stage) => stage.status)).toEqual(["done", "error", "done"]);
    expect(getAuditJob("job-1")?.events.map((event) => `${event.stage}:${event.status}`)).toEqual([
      "scope:running", "scope:done", "pull:running", "pull:error", "score:running", "score:done",
    ]);
  });
});
