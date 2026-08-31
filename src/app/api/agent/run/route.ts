import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AgentConfigurationError, AgentRuntimeError, parseAgentInput, runAdPilotAgent, shouldShowAuditPresentation } from "@/lib/agent/adpilot-agent";
import { getMetaSession, META_SESSION_COOKIE } from "@/lib/meta/session-store";

export const runtime = "nodejs";
// Non-audit (chat / playbook) still answers synchronously here. Give it headroom;
// 300s is the Vercel Pro ceiling. If the playbook path also times out in prod,
// it needs the same streaming treatment as the audit (see notes).
export const maxDuration = 300;

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = getMetaSession(cookieStore.get(META_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "AUTHENTICATION_REQUIRED", message: "Connect Meta before running the AdPilot agent." }, { status: 401 });
  try {
    const input = parseAgentInput(await request.json().catch(() => null));
    if (shouldShowAuditPresentation(input)) {
      // Classify only. The SSE stream route creates AND runs the staged audit
      // inside one request, so no job state must survive across instances.
      return NextResponse.json({ mode: "audit" }, { status: 202, headers: { "Cache-Control": "no-store" } });
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
