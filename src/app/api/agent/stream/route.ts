import { cookies } from "next/headers";
import { getAuditJob, subscribeAuditJob, type AuditProgressEvent } from "@/lib/audit/job-store";
import { startAuditJob, runDeepAuditJob } from "@/lib/audit/job-runner";
import { getMetaSession, META_SESSION_COOKIE } from "@/lib/meta/session-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The whole staged audit runs inside THIS one streaming request, so it must be
// allowed to live long enough to finish. 300s is the Vercel Pro ceiling; raise
// via Fluid Compute if you need more. On Hobby (60s) a deep audit will not fit —
// upgrade the plan or the request will be cut off mid-audit.
export const maxDuration = 300;

const encoder = new TextEncoder();
const sse = (event: string, value: unknown) => encoder.encode(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`);

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const session = getMetaSession(cookieStore.get(META_SESSION_COOKIE)?.value);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId") || "";
  const prompt = url.searchParams.get("prompt") || "";
  if (!accountId || !prompt) return new Response("Missing accountId or prompt", { status: 400 });

  // Create AND run the job inside this single request. Because creation,
  // execution, and streaming all happen in one process, no job state has to
  // survive across serverless instances — which is what broke the poll model.
  const job = startAuditJob({ accountId, prompt }, session.accessToken);
  const jobId = job.jobId;

  let unsubscribe = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const cleanup = () => { if (heartbeat) clearInterval(heartbeat); unsubscribe(); };

  const stream = new ReadableStream({
    start(controller) {
      const safeClose = () => { cleanup(); try { controller.close(); } catch {} };
      controller.enqueue(sse("snapshot", job));

      unsubscribe = subscribeAuditJob(jobId, (progress: AuditProgressEvent | null) => {
        if (progress) {
          controller.enqueue(sse("progress", progress));
          controller.enqueue(sse("snapshot", getAuditJob(jobId)));
        } else {
          controller.enqueue(sse("complete", getAuditJob(jobId)));
          safeClose();
        }
      });

      heartbeat = setInterval(() => controller.enqueue(encoder.encode(": keep-alive\n\n")), 15_000);
      request.signal.addEventListener("abort", safeClose);

      // Drive the full pipeline. Its per-stage events flow into this same open
      // stream via the subscription above; finishAuditJob emits the closing null.
      runDeepAuditJob(jobId, { accountId, prompt }, session.accessToken).catch((error) => {
        controller.enqueue(sse("progress", {
          jobId, stage: "assemble", label: "Audit failed", status: "error",
          error: error instanceof Error ? error.message : "The audit failed.", at: new Date().toISOString(),
        }));
        controller.enqueue(sse("complete", getAuditJob(jobId)));
        safeClose();
      });
    },
    cancel() { cleanup(); },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
