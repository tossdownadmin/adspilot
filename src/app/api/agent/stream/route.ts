import { cookies } from "next/headers";
import { getAuditJob, subscribeAuditJob } from "@/lib/audit/job-store";
import { getMetaSession, META_SESSION_COOKIE } from "@/lib/meta/session-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const encoder = new TextEncoder();
const sse = (event: string, value: unknown) => encoder.encode(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`);

export async function GET(request: Request) {
  const cookieStore = await cookies();
  if (!getMetaSession(cookieStore.get(META_SESSION_COOKIE)?.value)) return new Response("Unauthorized", { status: 401 });
  const jobId = new URL(request.url).searchParams.get("jobId") || "";
  const job = getAuditJob(jobId);
  if (!job) return new Response("Audit job not found", { status: 404 });
  let unsubscribe = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(sse("snapshot", job));
      unsubscribe = subscribeAuditJob(jobId, (progress) => {
        if (progress) controller.enqueue(sse("progress", progress));
        else {
          const finalJob = getAuditJob(jobId);
          controller.enqueue(sse("complete", finalJob));
          if (heartbeat) clearInterval(heartbeat);
          unsubscribe(); controller.close();
        }
      });
      heartbeat = setInterval(() => controller.enqueue(encoder.encode(": keep-alive\n\n")), 15_000);
      request.signal.addEventListener("abort", () => { if (heartbeat) clearInterval(heartbeat); unsubscribe(); try { controller.close(); } catch {} });
    },
    cancel() { if (heartbeat) clearInterval(heartbeat); unsubscribe(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
