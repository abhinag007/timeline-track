import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: real verification happens in requireUserId().
export function proxy(request: NextRequest) {
  if (!request.cookies.has("session")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|api/health|_next|favicon.ico|manifest.webmanifest|icon|apple-icon).*)"],
};
