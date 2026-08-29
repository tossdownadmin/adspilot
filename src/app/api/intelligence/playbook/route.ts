import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auditCampaigns, buildIntelligencePlaybook } from "@/lib/intelligence-engine";
import { runLiveMetaAudit } from "@/lib/meta/live-audit";
import { liveCampaignsToHistory } from "@/lib/meta/live-intelligence";
import { getMetaSession, META_SESSION_COOKIE } from "@/lib/meta/session-store";

export const runtime = "nodejs";

const RequestSchema = z.object({
  accountId: z.string().regex(/^\d{5,30}$/),
  brief: z.object({
    region: z.string().trim().min(1), product: z.string().trim().min(1), objective: z.enum(["sales", "leads", "traffic", "awareness"]),
    jtd: z.enum(["acquire_new", "first_order", "reactivate_lapsed", "promote_lto", "drive_catering", "lift_aov", "new_location_awareness", "loyalty_signup", "unknown"]),
    dailyBudget: z.number().positive(), offer: z.string(),
  }),
});

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = getMetaSession(cookieStore.get(META_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST", message: parsed.error.issues[0]?.message }, { status: 400 });
  try {
    const audit = await runLiveMetaAudit(session.accessToken, parsed.data.accountId);
    if (audit.campaigns.status !== "ok") return NextResponse.json({ error: "CAMPAIGNS_UNAVAILABLE", message: audit.campaigns.message }, { status: 503 });
    const results = auditCampaigns(liveCampaignsToHistory(audit.campaigns.data, audit.window));
    return NextResponse.json({ playbook: buildIntelligencePlaybook(results, parsed.data.brief) });
  } catch (error) {
    return NextResponse.json({ error: "PLAYBOOK_UNAVAILABLE", message: error instanceof Error ? error.message : "Playbook generation failed." }, { status: 503 });
  }
}
