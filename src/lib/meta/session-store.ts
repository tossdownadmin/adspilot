import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getMetaConfig } from "./config";

export const META_SESSION_COOKIE = "adpilot_meta_session";
export const META_OAUTH_STATE_COOKIE = "adpilot_meta_oauth_state";

type MetaSession = {
  accessToken: string;
  expiresAt: number;
};

export function createMetaSession(accessToken: string, expiresInSeconds: number) {
  const expiresAt = Date.now() + Math.max(60, expiresInSeconds - 60) * 1_000;
  return { id: encryptSession({ accessToken, expiresAt }), expiresAt };
}

export function getMetaSession(value?: string) {
  if (!value) return undefined;
  try {
    const session = decryptSession(value);
    return session.expiresAt > Date.now() ? session : undefined;
  } catch {
    return undefined;
  }
}

function encryptionKey() {
  const secret = getMetaConfig().appSecret;
  if (!secret) throw new Error("Meta app secret is required for local session encryption.");
  return createHash("sha256").update(`adpilot-meta-session:${secret}`).digest();
}

function encryptSession(session: MetaSession) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(session), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

function decryptSession(value: string): MetaSession {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Invalid local Meta session.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  const session = JSON.parse(plaintext) as Partial<MetaSession>;
  if (typeof session.accessToken !== "string" || typeof session.expiresAt !== "number") {
    throw new Error("Invalid local Meta session payload.");
  }
  return session as MetaSession;
}
