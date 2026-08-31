import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAuditJob } from "@/lib/audit/job-store";
import { advanceAuditJob } from "@/lib/audit/job-runner";
import { getMetaSession, META_SESSION_COOKIE } from "@/lib/meta/session-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  if (!getMetaSession(cookieStore.get(META_SESSION_COOKIE)?.value)) return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  const jobId = new URL(request.url).searchParams.get("jobId") || "";
  const job = getAuditJob(jobId);
  if (!job) return NextResponse.json({ error: "JOB_NOT_FOUND", message: "This audit job is unavailable. It may have landed on another server instance; start a new audit." }, { status: 404 });
  const advanced = await advanceAuditJob(jobId);
  return NextResponse.json(advanced ?? job, { headers: { "Cache-Control": "no-store" } });
}
