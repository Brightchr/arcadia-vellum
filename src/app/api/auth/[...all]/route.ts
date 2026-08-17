import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { isIpBanned } from "@/lib/bans";
import { jsonError } from "@/lib/api";

const handlers = toNextJsHandler(auth);

export const GET = handlers.GET;

/**
 * Auth mutations are the #1 brute-force target, so they get the tightest
 * limits: credential guessing and bulk account creation both stall out.
 * Banned networks are refused before better-auth ever sees the request.
 */
export async function POST(request: Request) {
  const path = new URL(request.url).pathname;
  const signInOrUp = path.includes("/sign-in") || path.includes("/sign-up");
  const limited = path.includes("/sign-in")
    ? rateLimit(request, "auth-signin", { limit: 10, windowMs: 5 * 60_000 })
    : path.includes("/sign-up")
      ? rateLimit(request, "auth-signup", { limit: 5, windowMs: 60 * 60_000 })
      : rateLimit(request, "auth-other", { limit: 30, windowMs: 60_000 });
  if (limited) return limited;
  if (signInOrUp && (await isIpBanned(clientIp(request)))) {
    return jsonError(
      "Sign-in isn't available from this network. Contact support if you believe this is a mistake.",
      403
    );
  }
  return handlers.POST(request);
}
