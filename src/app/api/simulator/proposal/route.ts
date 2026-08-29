import { NextResponse } from "next/server";
import { z } from "zod";
import { CampaignBriefSchema } from "@/lib/domain";
import { generateProposal, validateProposal } from "@/lib/engine";

export const runtime = "nodejs";

const WorkspaceSchema = z.object({ businessName: z.string(), websiteUrl: z.string(), category: z.string(), currency: z.string(), timezone: z.string(), maxDailyBudget: z.number(), connected: z.boolean() });
const RequestSchema = z.object({ action: z.enum(["generate", "validate"]), brief: CampaignBriefSchema, workspace: WorkspaceSchema });

export async function POST(request: Request) {
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST", message: parsed.error.issues[0]?.message }, { status: 400 });
  const { action, brief, workspace } = parsed.data;
  return action === "generate"
    ? NextResponse.json({ proposal: generateProposal(brief, workspace) })
    : NextResponse.json({ findings: validateProposal(brief, workspace) });
}
