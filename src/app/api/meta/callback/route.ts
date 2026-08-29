import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { exchangeMetaAuthorizationCode, getMetaConfig } from "@/lib/meta/config";
import { createMetaSession, META_OAUTH_STATE_COOKIE, META_SESSION_COOKIE } from "@/lib/meta/session-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const config = getMetaConfig();
  const code = request.nextUrl.searchParams.get("code");
  const returnedState = request.nextUrl.searchParams.get("state");
  const providerError = request.nextUrl.searchParams.get("error");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(META_OAUTH_STATE_COOKIE)?.value;
  const destination = new URL("/?view=connections", config.redirectUri);

  if (providerError) {
    destination.searchParams.set("meta", "cancelled");
    return clearStateAndRedirect(destination);
  }

  if (!code || !returnedState || !expectedState || returnedState !== expectedState) {
    destination.searchParams.set("meta", "invalid_state");
    return clearStateAndRedirect(destination);
  }

  try {
    const token = await exchangeMetaAuthorizationCode(code, config);
    const session = createMetaSession(token.accessToken, token.expiresInSeconds);
    destination.searchParams.set("meta", "connected");
    const response = clearStateAndRedirect(destination);
    response.cookies.set(META_SESSION_COOKIE, session.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: config.redirectUri.startsWith("https://"),
      expires: new Date(session.expiresAt),
      path: "/",
    });
    return response;
  } catch {
    destination.searchParams.set("meta", "exchange_failed");
    return clearStateAndRedirect(destination);
  }
}

function clearStateAndRedirect(destination: URL) {
  const response = NextResponse.redirect(destination);
  response.cookies.delete(META_OAUTH_STATE_COOKIE);
  return response;
}
