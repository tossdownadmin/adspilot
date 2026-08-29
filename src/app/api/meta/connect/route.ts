import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { buildMetaAuthorizationUrl, getMetaConfig, getMissingMetaConfig } from "@/lib/meta/config";
import { META_OAUTH_STATE_COOKIE } from "@/lib/meta/session-store";

export const runtime = "nodejs";

export async function GET() {
  const config = getMetaConfig();
  const missing = getMissingMetaConfig(config);
  if (missing.length) {
    return NextResponse.redirect(new URL(`/?view=connections&meta=config_required`, config.redirectUri));
  }

  const state = randomBytes(32).toString("base64url");
  const response = NextResponse.redirect(buildMetaAuthorizationUrl(state, config));
  response.cookies.set(META_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.redirectUri.startsWith("https://"),
    maxAge: 10 * 60,
    path: "/",
  });
  return response;
}
