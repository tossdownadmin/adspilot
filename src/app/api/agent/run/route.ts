import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AgentConfigurationError, AgentRuntimeError, parseAgentInput, runAdPilotAgent } from "@/lib/agent/adpilot-agent";
import { shouldShowAuditPresentation } from "@/lib/agent/adpilot-agent";
import { startAuditJob } from "@/lib/audit/job-runner";
import { getMetaSession, META_SESSION_COOKIE } from "@/lib/meta/session-store";

export const runtime = "nodejs";
// The start route only creates the job and returns 202. Polling advances one
// bounded stage per request, so no single request owns the complete audit.
// Multi-instance durability still requires a shared job store in a later phase.
export const maxDuration = 120;

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = getMetaSession(cookieStore.get(META_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "AUTHENTICATION_REQUIRED", message: "Connect Meta before running the AdPilot agent." }, { status: 401 });
  try {
    const input = parseAgentInput(await request.json().catch(() => null));
    if (shouldShowAuditPresentation(input)) {
      const job = startAuditJob({ accountId: input.accountId, prompt: input.prompt }, session.accessToken);
      return NextResponse.json({ jobId: job.jobId, status: job.status }, { status: 202, headers: { "Cache-Control": "no-store" } });
    }
    const run = await runAdPilotAgent(input, session.accessToken);
    return NextResponse.json(run, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AgentConfigurationError) return NextResponse.json({ error: "LLM_CONFIGURATION_REQUIRED", message: error.message }, { status: 503 });
    if (error instanceof AgentRuntimeError) return NextResponse.json({ error: "AGENT_RUN_FAILED", message: error.message }, { status: 502 });
    const message = error instanceof Error ? error.message : "The agent request is invalid.";
    return NextResponse.json({ error: "INVALID_REQUEST", message }, { status: 400 });
  }
}
