/**
 * In-memory token-bucket rate limiter, keyed per client IP per endpoint.
 * Right-sized for a single-instance deployment (Railway): counters live in
 * process memory and reset on deploy. If the app ever scales to multiple
 * replicas, swap the Map for Redis — call sites stay the same.
 */

interface Bucket {
  tokens: number;
  last: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 50_000;

/** Best-effort client IP behind Railway's proxy. */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

function sweep(windowMs: number) {
  // Opportunistic cleanup so the map can't grow unbounded under churn.
  if (buckets.size < MAX_BUCKETS) return;
  const cutoff = Date.now() - windowMs * 2;
  for (const [key, b] of buckets) {
    if (b.last < cutoff) buckets.delete(key);
  }
}

function takeToken(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): Response | null {
  const now = Date.now();
  const refillPerMs = limit / windowMs;

  let bucket = buckets.get(key);
  if (!bucket) {
    sweep(windowMs);
    bucket = { tokens: limit, last: now };
    buckets.set(key, bucket);
  } else {
    bucket.tokens = Math.min(limit, bucket.tokens + (now - bucket.last) * refillPerMs);
    bucket.last = now;
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return null;
  }
  const retryAfterSec = Math.max(1, Math.ceil((1 - bucket.tokens) / refillPerMs / 1000));
  return Response.json(
    { error: "Too many requests — slow down and try again shortly." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
        "Cache-Control": "no-store",
      },
    }
  );
}

/**
 * Allow `limit` requests per `windowMs` per IP for this endpoint name.
 * Returns null when allowed, or a ready-to-return 429 response.
 */
export function rateLimit(
  request: Request,
  name: string,
  opts: { limit: number; windowMs: number }
): Response | null {
  return takeToken(`${name}:${clientIp(request)}`, opts);
}

/**
 * Same bucket, keyed per signed-in user instead of per IP — for abuse that
 * an account (not a network) commits: chat floods, join sprees, invites.
 */
export function rateLimitUser(
  userId: string,
  name: string,
  opts: { limit: number; windowMs: number }
): Response | null {
  return takeToken(`${name}:u:${userId}`, opts);
}
