import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "./db";
import { logicalToday } from "./dates";

const COOKIE = "session";
const MAX_AGE_DAYS = 30;
const key = new TextEncoder().encode(process.env.SESSION_SECRET);

// The token carries the user's timezone and day cutoff so pages can work out
// "today" without a database round trip first.
type Session = { userId: string; tz?: string; cutoff?: number; demo?: boolean };

// Demo sessions end when their sandbox account is deleted (demoUntil).
export async function createSession(user: { id: string; timezone: string; day_cutoff_hour: number }, opts: { demoUntil?: Date } = {}) {
  const expiresAt = opts.demoUntil ?? new Date(Date.now() + MAX_AGE_DAYS * 86_400_000);
  const payload: Session = { userId: user.id, tz: user.timezone, cutoff: user.day_cutoff_hour };
  if (opts.demoUntil) payload.demo = true;
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(key);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    if (typeof payload.userId !== "string") return null;
    return {
      userId: payload.userId,
      tz: typeof payload.tz === "string" ? payload.tz : undefined,
      cutoff: typeof payload.cutoff === "number" ? payload.cutoff : undefined,
      demo: payload.demo === true,
    };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

// Use in every page, action and route handler that touches user data.
export async function requireUserId(): Promise<string> {
  return (await requireSession()).userId;
}

// The signed-in user plus their logical "today" (timezone and 4 AM cutoff applied).
export async function requireToday(): Promise<{ userId: string; timezone: string; today: string }> {
  const session = await requireSession();
  let { tz, cutoff } = session;
  if (tz === undefined || cutoff === undefined) {
    // Tokens issued before the timezone was added to them.
    const [user] = await sql`select timezone, day_cutoff_hour from users where id = ${session.userId}`;
    if (!user) redirect("/login");
    tz = user.timezone as string;
    cutoff = user.day_cutoff_hour as number;
  }
  return { userId: session.userId, timezone: tz, today: logicalToday(tz, cutoff) };
}
