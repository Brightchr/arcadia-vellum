# Vellum (by Arcadia)

Write, listen, and share TTRPG journals as beautifully bound tomes and audiobooks. Turn a campaign journal — a Google Doc, an uploaded `.docx`/`.md`/`.txt`, the built-in editor, or narration audio — into a page-flipping ancient tome, publish it to a community store, and gather your table into chat groups around it. Built for the journal of **Eveline Veyr**, witch of DaggerHeart; works for any table.

Live at [vellum-books.org](https://vellum-books.org).

## Features

- **Tomes & audiobooks** — themed page-flip reader with measurement-based pagination; audiobook player with chapters, segments, speed, position memory, and lock-screen controls. Series/volumes, playlists, revocable share links, and request-access flows for restricted works.
- **The Store** — public catalog with genre chips, full-text search, format/review filters, Steam-style review sentiment, and a personalized **"For you"** ordering learned from saves, reads, ratings, and per-work "Not interested" dismissals.
- **Social** — Steam-style friends list with online presence and "Reading …" status (opt-out in settings), one-way follows, reviews, and a desktop social rail (friends / pinnable groups / alerts).
- **Groups** — Discord-style text communities: channels with thumbnails, group avatars, colored ranks, per-channel posting permissions, NSFW channel gates, spoiler/NSFW message flags, mutes with real unread tracking, welcome messages, invites, and @mentions.
- **Notifications** — in-app alerts split into a social rail and a system bell, plus **Web Push** to enrolled devices (PC browsers and Android/PWA) for mentions, invites, and friend requests — with channel deep links.
- **Theming** — five fantasy app skins plus clean **Midnight (dark)** and **Daylight (light)** standard themes; per-book bindings; a custom theme builder (colors, fonts, textures, ambience).
- **Moderation** — group kick/ban with optional escalation to platform moderators, temporary platform-wide muting while reports are reviewed, an admin reports queue, bans, and an append-only audit log. Rate limiting per IP *and* per account.
- **Apps** — installable PWA (manifest + service worker) for desktop and Android; a Capacitor thin-shell Android project lives in `android/` (see `docs/ANDROID.md`).

## Stack

- **Next.js 16** (App Router, Turbopack) + Tailwind CSS 4
- **Postgres** + **Drizzle ORM** (migrations auto-apply on boot via `instrumentation.ts`)
- **Better Auth** — email/password + Google sign-in
- **S3-compatible object storage** for media (Railway Buckets / MinIO / R2) with Postgres fallback
- **web-push** (VAPID) for device notifications
- **Google Picker + Drive API** (`drive.file` scope — non-sensitive, per-file access)
- **mammoth** (docx → HTML), **marked** (Markdown), **sanitize-html**
- **react-pageflip-enhanced** (StPageFlip) with custom measurement-based pagination
- **Capacitor** (Android shell)

## Local development

```bash
docker compose up -d        # Postgres on :5433 + MinIO (S3) on :9000/:9001
npm install
cp .env.example .env        # defaults work for local dev
npm run db:migrate          # apply migrations (also happens on boot)
npm run dev                 # http://localhost:3000
```

Email/password accounts work with zero configuration. Everything else is progressive:

- **Media storage**: with no `S3_*` vars, uploads store in Postgres (fine for dev). To exercise the bucket path, create a `vellum` bucket in the MinIO console (`localhost:9001`, minioadmin/minioadmin) and set the `S3_*` vars from `.env.example`.
- **Push notifications**: disabled until VAPID keys exist — `npx web-push generate-vapid-keys`, then fill the `VAPID_*` vars.
- **Google sign-in / Doc linking**: needs the Google Cloud credentials below.

## Media storage (object bucket)

Audio, covers, page images, and avatars live in an S3-compatible bucket when configured (`S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, `S3_REGION`, `S3_FORCE_PATH_STYLE`). Serving routes 302-redirect to short-lived signed URLs, so media bandwidth (including audio seeking via Range) bypasses the app server and database entirely. Rows created before a bucket existed keep serving from Postgres — both shapes work forever.

To move legacy media into the bucket (resumable; safe to re-run):

```bash
node scripts/migrate-media-to-bucket.mjs --dry-run   # counts only
node scripts/migrate-media-to-bucket.mjs
```

## Google Cloud setup (one-time, ~10 minutes)

1. Go to [console.cloud.google.com](https://console.cloud.google.com), create a project. Note the **project number** (Dashboard → Project info).
2. **APIs & Services → Library**: enable **Google Drive API** and **Google Picker API**.
3. **APIs & Services → OAuth consent screen**: User type **External** → fill app name + your email. Add yourself (and your players) under **Test users**. Leave it in *Testing* mode for now (up to 100 test users; no Google review needed since we only use the non-sensitive `drive.file` scope).
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**: type **Web application**.
   - Authorized JavaScript origins: `http://localhost:3000` and your production origin.
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google` and `https://<your-domain>/api/auth/callback/google`.
   - Copy the **client ID** and **client secret**.
5. **Credentials → Create credentials → API key**. Restrict it to the Picker API (recommended). Copy it.
6. Fill `.env`:

```
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
NEXT_PUBLIC_GOOGLE_API_KEY=AIza...
NEXT_PUBLIC_GOOGLE_PROJECT_NUMBER=123456789012
```

How doc access works: users click **Connect Google Drive** (adds the `drive.file` scope to their account), then pick their journal document in the Google Picker. Picking a file grants the app read access to *that file only*. Sync exports the doc as HTML via the Drive API; a **Resync** button and a 10-minute auto-refresh on the owner's view keep it current.

## Deploy to Railway

1. Create a Railway project from this repo (Railpack auto-detects Next.js; Node ≥ 20 comes from `package.json` `engines`).
2. Add the **PostgreSQL** plugin and a **Storage Bucket**.
3. Service → Settings → **Start command**: `npm run railway:start` (runs DB migrations, then starts Next).
4. Service → Variables:
   - `DATABASE_URL` → reference the Postgres plugin's `DATABASE_URL`
   - `BETTER_AUTH_SECRET` → `openssl rand -base64 32`
   - `BETTER_AUTH_URL` → `https://<your-domain>`
   - `S3_BUCKET` / `S3_ENDPOINT` / `S3_REGION` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_FORCE_PATH_STYLE=true` → from the bucket's Credentials panel
   - `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` → `npx web-push generate-vapid-keys` (keys are permanent — rotating un-enrolls every device)
   - `BLOCKED_COUNTRIES` (optional) → comma-separated ISO codes for the app-level geo backstop
   - the four Google vars from above
5. Deploy. Migrations and (if configured) media/push wire themselves up on boot.

Recommended in front: **Cloudflare** (free) proxying the domain — WAF country rules, bot fighting, DDoS protection, and Email Routing for a `support@` address. The app trusts `CF-Connecting-IP` for rate limiting and honors `CF-IPCountry` in `src/proxy.ts` when `BLOCKED_COUNTRIES` is set.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | production build |
| `npm run db:generate` | generate a new migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | apply migrations |
| `npm run railway:start` | migrate + start (Railway start command) |
| `node scripts/migrate-media-to-bucket.mjs` | move legacy Postgres media into the bucket |

## Architecture notes

- **One content pipeline**: every source (Drive export, docx, md, txt, editor) converges to sanitized HTML stored in `journal_content`; images and audio are captured as media rows and served from `/api/images/[id]`, `/api/audio/[id]`, and `/api/avatars/[id]` with visibility enforced. Media bytes live in the bucket (signed-URL redirects) or, for legacy/dev rows, Postgres `bytea` — `src/lib/media.ts` is the single switch point.
- **Pagination** ([src/components/book/paginate.ts](src/components/book/paginate.ts)): content is measured in a hidden element styled exactly like a real page, split block-by-block (binary word search inside oversized paragraphs, list numbering preserved), after fonts and images load. The book remounts on resize/theme change since StPageFlip needs fixed pages.
- **Theming is two systems**: app chrome skins are CSS-variable bundles in [src/app/globals.css](src/app/globals.css) (`--void`/`--ink`/`--arcane` + surface tokens, so light mode works everywhere); per-book tome bindings live in [src/app/themes.css](src/app/themes.css) with user-built themes generated from validated configs. Adding an app skin = one CSS block + one entry in [src/lib/themes.ts](src/lib/themes.ts).
- **Social is polling, not sockets**: chat polls its open channel (5s), the rail refreshes at 60s, presence heartbeats at 60s while the tab is visible. Stateless, cache-friendly, single-instance-safe; unread dots come from per-channel read markers, and mutes suppress them at query time.
- **Notifications fan out from one place**: `notify()` writes the in-app row and fires Web Push (`src/lib/push.ts`) for mention/invite/friend events to every enrolled device, pruning dead endpoints on bounce. The service worker (`public/sw.js`) shows the toast and deep-links into the right channel.
- **Personalization is transparent math**: a per-user tag-affinity profile (saves +3, loved reviews +3, opens +2, pans −2, dislikes −3) reorders the store when no explicit sort is chosen; disliked works vanish from every discovery surface.
- **Moderation degrades safely**: reports mute the reported account platform-wide until an admin resolves them; all enforcement (posting, reviews) checks at the API layer, and every admin action lands in an append-only audit table.
