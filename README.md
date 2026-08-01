# Arcadia Vellum

Turn a TTRPG campaign journal — a Google Doc or an uploaded `.docx`/`.md`/`.txt` — into a page-flipping ancient tome you can theme and share. Built for the journal of **Eveline Veyr**, witch of DaggerHeart; works for any table.

## Stack

- **Next.js 16** (App Router, Turbopack) + Tailwind CSS 4
- **Postgres** + **Drizzle ORM**
- **Better Auth** — email/password + Google sign-in
- **Google Picker + Drive API** (`drive.file` scope — non-sensitive, per-file access; private docs work without Google's sensitive-scope verification)
- **mammoth** (docx → HTML), **marked** (Markdown), **sanitize-html**
- **react-pageflip-enhanced** (StPageFlip) with custom measurement-based pagination

## Local development

```bash
docker compose up -d        # Postgres on localhost:5433
npm install
cp .env.example .env        # defaults work for local dev
npm run db:migrate          # apply migrations
npm run dev                 # http://localhost:3000
```

Email/password accounts work with zero configuration. Google sign-in and Google Doc linking need the credentials below.

A dev test account exists locally: `testwitch@example.com` / `hexes4days` (with one sample journal).

## Google Cloud setup (one-time, ~10 minutes)

1. Go to [console.cloud.google.com](https://console.cloud.google.com), create a project (e.g. `tome-keeper`). Note the **project number** (Dashboard → Project info).
2. **APIs & Services → Library**: enable **Google Drive API** and **Google Picker API**.
3. **APIs & Services → OAuth consent screen**: User type **External** → fill app name + your email. Add yourself (and your players) under **Test users**. Leave it in *Testing* mode for now (up to 100 test users; no Google review needed since we only use the non-sensitive `drive.file` scope).
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**: type **Web application**.
   - Authorized JavaScript origins: `http://localhost:3000` and your Railway URL.
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google` and `https://<your-railway-domain>/api/auth/callback/google`.
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
2. Add the **PostgreSQL** plugin.
3. Service → Settings → **Start command**: `npm run railway:start` (runs DB migrations, then starts Next).
4. Service → Variables:
   - `DATABASE_URL` → reference the Postgres plugin's `DATABASE_URL`
   - `BETTER_AUTH_SECRET` → `openssl rand -base64 32`
   - `BETTER_AUTH_URL` → `https://<your-railway-domain>`
   - the four Google vars from above (with the Railway domain added to the OAuth client's origins/redirects)
5. Deploy. Done.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | production build |
| `npm run db:generate` | generate a new migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | apply migrations |
| `npm run railway:start` | migrate + start (Railway start command) |

## Architecture notes

- **One content pipeline**: every source (Drive export, docx, md, txt) converges to sanitized HTML stored in `journal_content`; images are captured into `journal_images` (Postgres `bytea`) and served from `/api/images/[id]` with the journal's visibility enforced — no filesystem/volume needed.
- **Pagination** ([src/components/book/paginate.ts](src/components/book/paginate.ts)): content is measured in a hidden element styled exactly like a real page, split block-by-block (binary word search inside oversized paragraphs, list numbering preserved), after fonts and images load. The book remounts on resize/theme change since StPageFlip needs fixed pages.
- **Themes** ([src/app/themes.css](src/app/themes.css)): each theme is a CSS-variable bundle (palette, paper texture from SVG noise data-URIs, font pairing via `next/font`). Adding a theme = one CSS block + one entry in [src/lib/themes.ts](src/lib/themes.ts).
