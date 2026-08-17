# Changes — Security Hardening & Admin Observability Plan

Working doc from the August 2026 scalability/security audit. Temporary — delete
once the items land as real issues/commits.

## Landed on dev — 2026-08-17

Security items 1–6 below are DONE (plus the "smaller fixes" indexes), along
with a moderation suite that grew out of them:

- **Origin lock** (`ORIGIN_SECRET` + `X-Origin-Auth` check in `src/proxy.ts`).
  Needs two manual steps to activate: set the env var on Railway and add the
  matching Cloudflare Transform Rule.
- **Auth hardening**: `trustedOrigins`, 5-min session cookie cache,
  `minPasswordLength: 12`, and env-gated Cloudflare Turnstile on
  sign-in/sign-up (set `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
  to activate; inert until both are present).
- **Rate limits** on friends/follow/message-polling/social/uploads.
- **Upload hardening**: Content-Length prechecks before buffering, file-count
  + 200 MB request cap on audio, magic-byte sniffing everywhere (stored
  content types no longer trust the client), SSRF guards + 50-image cap in
  `localizeImages`.
- **Pool bounds + advisory-locked boot migrations** (failed migrations now
  crash the boot instead of serving a wrong schema).
- **Daily cleanup sweep**: expired sessions/verifications, 30-day-old read
  notifications, expired share links, expired IP bans.
- **Indexes**: `push_subscriptions(user_id)`,
  `notifications(user_id, created_at desc)`, `user_reports(user_id, status)`.
- **Moderation suite**:
  - Tiered account bans (24h/7d/30d/permanent) with built-in reasons
    (`src/lib/ban-reasons.ts`) shown at sign-in; sessions revoked on ban;
    suspensions auto-expire.
  - IP bans (optional checkbox on the ban dialog) built from the account's
    known session IPs; sign-in/sign-up refused from banned networks; lifted
    on unban; auth sessions now record the Cloudflare client IP.
  - Work takedowns: ban a tome/audiobook from the store with a reason — the
    owner still sees it (marked banned, with the reason) on their shelves
    and book page; everyone else 404s, media URLs included.
  - Admin media review: the user inspection page now shows profile images
    (avatars/banners/textures), playable audio, read/listen links into any
    work (admins bypass access checks for review), known sign-in IPs, and
    per-work ban/restore controls.

Still open: the admin dashboard observability tiles (section below), email
verification (needs a mail provider), image resizing, and the perf batch
(markChannelRead skip, listNotifications N+1, mention fanout).

## Already resolved (verified 2026-08-13)

- **Media backfill to bucket: done.** `migrate-media-to-bucket.mjs --dry-run`
  against production reports 0 pending rows in `journal_audio`,
  `journal_images`, `profile_images`. Postgres volume is at 262 MB / 5 GB — no
  bloat to reclaim, no `VACUUM FULL` needed.
- **Egress cost: non-issue.** Railway buckets bill $0.015/GB-month storage
  with free unlimited egress and S3 ops, including presigned URLs — the
  app's 302-redirect serving path costs nothing in bandwidth.

## Security work, in priority order

### 1. Lock the origin to Cloudflare (small — do first)

The Railway hostname is publicly reachable, and `clientIp()`
(`src/lib/rate-limit.ts`) trusts `CF-Connecting-IP` unconditionally. Direct
origin requests can spoof a fresh IP per request, defeating every per-IP rate
limit (including auth brute-force and signup caps) and the country block.

- Add a shared-secret header via a Cloudflare Transform Rule
  (e.g. `X-Origin-Auth: <random>`).
- Reject requests missing it in `src/proxy.ts` (skip when the env var is
  unset so local dev is unaffected).

### 2. Harden better-auth config (`src/lib/auth.ts` is near-default)

- `trustedOrigins: ["https://vellum-books.org"]` — app currently answers on
  two hosts.
- `session.cookieCache` — also the biggest perf win: every 5s chat poll and
  every RSC render currently does a session DB round-trip.
- `minPasswordLength: 12`.
- Cloudflare **Turnstile** on signup/login — free, fits existing stack;
  substitutes for missing captcha/lockout.
- Email verification: deferred until we have an email sender
  (support address currently has no MX).

### 3. Rate-limit the unprotected endpoints

The limiter + pattern already exist; these routes have none:

- `POST /api/friends/[userId]` and `POST /api/follow/[userId]` — each call
  writes a row + notification + web push. Spam vector.
- `GET .../messages` — the 5s polling endpoint, highest QPS in the app
  (POST is limited, GET is not).
- `GET /api/social` — most expensive read, polled every 60s per tab.
- Upload routes: profile avatar/banner, theme texture, journal audio/upload.

### 4. Upload hardening

- Total request size + file count cap on `api/journals/[id]/audio` — it
  currently buffers the whole multipart body in memory (20×100 MB in one
  request ≈ 2 GB resident → OOM).
- Sniff magic bytes instead of trusting client `file.type` / filename
  extension for stored content types.
- Host allowlist in `src/lib/content/images.ts` `localizeImages` — currently
  fetches any URL found in ingested HTML (SSRF), and reads the body before
  the 5 MB check.
- Image resizing (`sharp`) on avatar/banner/group images — UX, not cost.

### 5. Multi-instance prep (before ever adding a replica)

- `pg.Pool` config in `src/db/index.ts`: `max`, `idleTimeoutMillis`,
  `connectionTimeoutMillis`.
- Advisory lock around boot migration (`src/instrumentation.ts`) — two
  replicas currently race; failures are swallowed.
- Rate limiter → shared store (Postgres-backed fine at current scale).

### 6. Cleanup jobs (single daily sweep covers all)

- Expired better-auth `session` / `verification` rows.
- Read notifications older than N days.
- Expired `share_links`.
- Stale `push_subscriptions` (pruning is currently only on send-bounce).
- Stale `reading_activity` rows.

### Smaller fixes worth batching in

- Missing indexes: `push_subscriptions(user_id)`,
  `notifications(user_id, created_at DESC)`, `user_reports(user_id, status)`.
- `markChannelRead` writes on every poll even with no new messages — skip
  the upsert when nothing changed.
- `listNotifications` N+1 (up to 20 queries per 60s social poll) — batch it.
- Mention push fanout is a sequential awaited loop in the message POST
  handler; hoist the shared actor/group lookups and detach.

## Admin dashboard additions

Today the dashboard answers "is anyone misbehaving?" (5 moderation tiles,
reports queue, user search/ban). It should also answer "is someone attacking
us?" and "is the app healthy?". Everything below is a Postgres query in the
same `Promise.all` — no metrics infra needed.

### Abuse & security signals

| Tile / panel | Source | Why |
|---|---|---|
| Signups last 24h / 7d | `user.created_at` | Spike = bot registration |
| Rate-limit rejections (24h) | counter in `rate-limit.ts` | Limits being probed — currently invisible |
| Messages / reports last 24h | existing tables | Spam-wave detector |
| Muted users | open `user_reports` count | Complements the banned tile |
| Newest accounts | existing `listUsersForAdmin` | Sort newest-first, "created N min ago" flag |

### Platform health

- DAU / WAU from `user.last_seen_at` (presence beacon already maintains it).
- DB size + top-5 largest tables (`pg_total_relation_size`) — catches
  unbounded growth (notifications, messages, reading_activity) early.
- Notification backlog count and push-subscription count — the two tables
  with no cleanup.
- Messages/day, works published/day — growth curves.

### Supporting schema additions

1. **`admin_audit_log`** — who banned/unbanned/resolved what, when. Admin
   actions currently leave no trace. Render as a panel under the reports
   queue.
2. **Store signup country** (from `cf-ipcountry`, available at request time)
   — makes the country block auditable and helps abuse triage. Country only;
   don't store raw IPs.

### Explicitly not building

Error tracking in the dashboard — add Sentry (free tier) and link out.

## Suggested first slice (~1 day)

Items 1–3 plus the abuse-signal tiles: covers the "someone attacks us next
week" scenario end to end.
