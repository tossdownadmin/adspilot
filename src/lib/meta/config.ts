export const META_OAUTH_PERMISSIONS = [
  "ads_mcp_management",
  "ads_read",
  "ads_management",
  "catalog_management",
  "business_management",
  "pages_show_list",
  "instagram_basic",
] as const;

export type MetaConfig = {
  appId: string;
  appSecret?: string;
  redirectUri: string;
  graphApiVersion: string;
  mcpServerUrl: string;
};

export function getMetaConfig(): MetaConfig {
  return {
    appId: process.env.META_APP_ID?.trim() || "2478727052619848",
    appSecret: process.env.META_APP_SECRET?.trim() || undefined,
    redirectUri: process.env.META_REDIRECT_URI?.trim() || "http://localhost:3000/api/meta/callback",
    graphApiVersion: process.env.META_GRAPH_API_VERSION?.trim() || "v26.0",
    mcpServerUrl: process.env.META_MCP_SERVER_URL?.trim() || "https://mcp.facebook.com/ads",
  };
}

export function getMissingMetaConfig(config = getMetaConfig()) {
  const missing: string[] = [];
  if (!config.appId) missing.push("META_APP_ID");
  if (!config.appSecret) missing.push("META_APP_SECRET");
  if (!config.redirectUri) missing.push("META_REDIRECT_URI");
  return missing;
}

export function buildMetaAuthorizationUrl(state: string, config = getMetaConfig()) {
  const url = new URL("https://www.facebook.com/dialog/oauth");
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", META_OAUTH_PERMISSIONS.join(","));
  return url;
}

export async function exchangeMetaAuthorizationCode(code: string, config = getMetaConfig()) {
  if (!config.appSecret) throw new Error("Meta app secret is not configured.");

  const url = new URL(`https://graph.facebook.com/${config.graphApiVersion}/oauth/access_token`);
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("client_secret", config.appSecret);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("code", code);

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await response.json().catch(() => null)) as
    | { access_token?: string; expires_in?: number; error?: { message?: string } }
    | null;

  if (!response.ok || !body?.access_token) {
    throw new Error(body?.error?.message || "Meta did not return an access token.");
  }

  return {
    accessToken: body.access_token,
    expiresInSeconds: body.expires_in ?? 60 * 60,
  };
}
