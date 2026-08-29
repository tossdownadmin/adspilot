import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMetaSession, getMetaSession } from "./session-store";

describe("local encrypted Meta session", () => {
  beforeEach(() => {
    process.env.META_APP_SECRET = "unit-test-app-secret";
  });

  afterEach(() => {
    delete process.env.META_APP_SECRET;
  });

  it("round-trips an access token without placing it in plaintext", () => {
    const session = createMetaSession("private-user-token", 3600);
    expect(session.id).not.toContain("private-user-token");
    expect(getMetaSession(session.id)?.accessToken).toBe("private-user-token");
  });

  it("fails closed when the encrypted value is modified", () => {
    const session = createMetaSession("private-user-token", 3600);
    expect(getMetaSession(`${session.id}x`)).toBeUndefined();
  });
});
