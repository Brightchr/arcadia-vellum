import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge gate, two checks — both no-ops until their env var is set:
 *
 * 1. Origin lock. ORIGIN_SECRET must match the X-Origin-Auth header, which a
 *    Cloudflare Transform Rule stamps onto every proxied request. Requests
 *    that reach Railway directly carry no such header and are refused —
 *    without this, a direct request can spoof CF-Connecting-IP and get a
 *    fresh rate-limit bucket per request, and skip the country block.
 *
 * 2. Country block — a backstop behind Cloudflare's WAF rule. When traffic
 *    arrives through Cloudflare, CF-IPCountry carries the visitor's country;
 *    anything on the BLOCKED_COUNTRIES list (comma-separated ISO codes,
 *    e.g. "CN,RU,KP,IR") is refused here too.
 */

const originSecret = process.env.ORIGIN_SECRET ?? "";

const blocked = new Set(
  (process.env.BLOCKED_COUNTRIES ?? "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c))
);

export function proxy(request: NextRequest) {
  if (originSecret && request.headers.get("x-origin-auth") !== originSecret) {
    return new NextResponse("Forbidden", {
      status: 403,
      headers: { "Content-Type": "text/plain" },
    });
  }
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
  // Skip genuinely static assets only. `_next/image` stays INSIDE the lock —
  // it's a live CPU-heavy optimizer endpoint, not a static file.
  matcher: ["/((?!_next/static|icons/|mark.png|sw.js).*)"],
};
