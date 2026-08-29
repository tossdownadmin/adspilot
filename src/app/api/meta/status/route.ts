import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getMetaConfig, getMissingMetaConfig } from "@/lib/meta/config";
import { listMetaAdAccounts, MetaMcpError } from "@/lib/meta/mcp-client";
import { getMetaSession, META_SESSION_COOKIE } from "@/lib/meta/session-store";

export const runtime = "nodejs";

export async function GET() {
  const config = getMetaConfig();
  const missing = getMissingMetaConfig(config);
  const safeBase = { appId: config.appId, redirectUri: config.redirectUri };

  if (missing.length) {
    return NextResponse.json({
      state: "CONFIGURATION_REQUIRED",
      missing,
      ...safeBase,
    });
  }

  const cookieStore = await cookies();
  const session = getMetaSession(cookieStore.get(META_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ state: "READY_TO_CONNECT", accounts: [], ...safeBase });

  try {
    const accounts = await listMetaAdAccounts(session.accessToken);
    return NextResponse.json({ state: "CONNECTED", accounts, ...safeBase });
  } catch (error) {
    const expired = error instanceof MetaMcpError && error.status === 401;
    return NextResponse.json(
      {
        state: expired ? "AUTHENTICATION_EXPIRED" : "PROVIDER_UNAVAILABLE",
        accounts: [],
        message: error instanceof Error ? error.message : "Meta Ads MCP could not be reached.",
        ...safeBase,
      },
      { status: expired ? 401 : 503 },
    );
  }
}
