import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { runLiveMetaAudit } from "@/lib/meta/live-audit";
import { auditCampaigns } from "@/lib/intelligence-engine";
import { liveCampaignsToHistory } from "@/lib/meta/live-intelligence";
import { getMetaSession, META_SESSION_COOKIE } from "@/lib/meta/session-store";

export const runtime = "nodejs";

const AuditRequestSchema = z.object({ accountId: z.string().regex(/^\d{5,30}$/, "Select a valid Meta ad account.") });

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = getMetaSession(cookieStore.get(META_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });

  const parsed = AuditRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST", message: parsed.error.issues[0]?.message }, { status: 400 });
  }

  try {
    const audit = await runLiveMetaAudit(session.accessToken, parsed.data.accountId);
    const intelligenceResults = audit.campaigns.status === "ok" ? auditCampaigns(liveCampaignsToHistory(audit.campaigns.data, audit.window)) : [];
    return NextResponse.json({ audit, intelligenceResults });
  } catch (error) {
    return NextResponse.json(
      { error: "PROVIDER_UNAVAILABLE", message: error instanceof Error ? error.message : "The live audit could not run." },
      { status: 503 },
    );
  }
}
