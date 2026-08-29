import { NextResponse } from "next/server";
import { META_SESSION_COOKIE } from "@/lib/meta/session-store";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ disconnected: true });
  response.cookies.delete(META_SESSION_COOKIE);
  return response;
}
