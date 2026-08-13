import { NextResponse, type NextRequest } from "next/server";

/**
 * App-level country block — a backstop behind Cloudflare's WAF rule. When
 * traffic arrives through Cloudflare, CF-IPCountry carries the visitor's
 * country; anything on the BLOCKED_COUNTRIES list (comma-separated ISO
 * codes, e.g. "CN,RU,KP,IR") is refused here too. Direct-to-Railway traffic
 * has no such header and passes — the edge rule remains the primary gate.
 * With the env var unset, this middleware is a no-op.
 */

const blocked = new Set(
  (process.env.BLOCKED_COUNTRIES ?? "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c))
);

export function proxy(request: NextRequest) {
  if (blocked.size === 0) return NextResponse.next();
  const country = request.headers.get("cf-ipcountry")?.toUpperCase();
  if (country && blocked.has(country)) {
    return new NextResponse("Not available in your region.", {
      status: 451,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return NextResponse.next();
}

export const config = {
  // Skip static assets; everything else (pages + API) gets checked.
  matcher: ["/((?!_next/static|_next/image|icons/|mark.png|sw.js).*)"],
};
