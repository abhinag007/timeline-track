import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { requireSession } from "./session";

// Demo visitors bring their own Anthropic API key. It lives only in their browser,
// in an httpOnly cookie encrypted with AES-256-GCM and bound to their demo account.
// It is never written to the database, and demo sessions never use the server key.
const COOKIE = "claude_key";
const secret = createHash("sha256").update(`${process.env.SESSION_SECRET}:claude-key`).digest();

function encrypt(apiKey: string, userId: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret, iv);
  cipher.setAAD(Buffer.from(userId));
  const data = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}

function decrypt(value: string, userId: string): string | null {
  try {
    const raw = Buffer.from(value, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", secret, raw.subarray(0, 12));
    decipher.setAAD(Buffer.from(userId));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export async function readDemoKey(userId: string): Promise<string | null> {
  const value = (await cookies()).get(COOKIE)?.value;
  return value ? decrypt(value, userId) : null;
}

export async function storeDemoKey(userId: string, apiKey: string, expires: Date) {
  (await cookies()).set(COOKIE, encrypt(apiKey, userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function clearDemoKey() {
  (await cookies()).delete(COOKIE);
}

export type ClaudeKey = { apiKey: string } | { error: string; needKey?: true };

// The key to call Claude with for this request.
export async function claudeKeyForRequest(): Promise<ClaudeKey> {
  const session = await requireSession();
  if (session.demo) {
    const apiKey = await readDemoKey(session.userId);
    return apiKey ? { apiKey } : { error: "Add your Claude API key to try this in the demo.", needKey: true };
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return apiKey ? { apiKey } : { error: "Add your Anthropic API key as ANTHROPIC_API_KEY in .env.local, then restart the app." };
}
