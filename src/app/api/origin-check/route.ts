export const runtime = "nodejs";

/**
 * TEMPORARY diagnostic for the Cloudflare origin-lock rollout. Reports
 * whether the X-Origin-Auth header reached the origin, its length, and
 * whether it matches ORIGIN_SECRET — never the value itself. Delete once
 * the lock is verified live.
 */
export async function GET(request: Request) {
  const value = request.headers.get("x-origin-auth");
  const secret = process.env.ORIGIN_SECRET ?? "";
  return Response.json(
    {
      viaCloudflare: Boolean(request.headers.get("cf-ray")),
      headerPresent: value !== null,
      headerLength: value?.length ?? 0,
      matchesSecret: secret ? value === secret : "secret not set",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
