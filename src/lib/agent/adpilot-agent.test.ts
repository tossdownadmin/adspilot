import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentConfigurationError, getAgentConfig, parseAgentInput, runAdPilotAgent } from "./adpilot-agent";

describe("AdPilot agent boundary", () => {
  const initialKey = process.env.OPENAI_API_KEY;
  const initialModel = process.env.OPENAI_MODEL;

  afterEach(() => {
    if (initialKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = initialKey;
    if (initialModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = initialModel;
    vi.unstubAllGlobals();
  });

  it("validates the account-scoped agent request", () => {
    expect(parseAgentInput({ accountId: "720643091975703", prompt: "Audit top campaigns" })).toMatchObject({ accountId: "720643091975703" });
    expect(() => parseAgentInput({ accountId: "bad", prompt: "Audit" })).toThrow(/valid Meta ad account/);
  });

  it("fails closed until a server-only LLM key is configured", async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(runAdPilotAgent({ accountId: "720643091975703", prompt: "Audit top campaigns" }, "meta-token")).rejects.toBeInstanceOf(AgentConfigurationError);
  });

  it("keeps the model name configurable", () => {
    process.env.OPENAI_MODEL = "account-approved-model";
    expect(getAgentConfig().model).toBe("account-approved-model");
  });
});
