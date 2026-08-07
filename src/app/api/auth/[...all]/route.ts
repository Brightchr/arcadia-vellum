import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

const handlers = toNextJsHandler(auth);

export const GET = handlers.GET;

/**
 * Auth mutations are the #1 brute-force target, so they get the tightest
 * limits: credential guessing and bulk account creation both stall out.
 */
export async function POST(request: Request) {
  const path = new URL(request.url).pathname;
  const limited = path.includes("/sign-in")
    ? rateLimit(request, "auth-signin", { limit: 10, windowMs: 5 * 60_000 })
    : path.includes("/sign-up")
      ? rateLimit(request, "auth-signup", { limit: 5, windowMs: 60 * 60_000 })
      : rateLimit(request, "auth-other", { limit: 30, windowMs: 60_000 });
  if (limited) return limited;
  return handlers.POST(request);
}
