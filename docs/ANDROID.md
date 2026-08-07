# Vellum on Android (Capacitor thin shell)

The Android app is a native wrapper around the live site — one codebase.
Every deploy to Railway updates the app instantly; the Play build only
changes when the shell itself does.

## One-time setup

1. Install Android Studio (bundles the Android SDK).
2. Set the production URL in `capacitor.config.ts` (`server.url`), e.g.
   `https://vellum.yourdomain.com`. It must be HTTPS.
3. Sync the config into the Android project:

   ```bash
   npx cap sync android
   ```

4. Open and build:

   ```bash
   npx cap open android
   ```

   In Android Studio: Build → Generate Signed App Bundle. Create a keystore
   the first time and BACK IT UP — losing it means losing the ability to
   update the app on Play.

5. Play Console (one-time $25): create the app, upload the bundle, fill the
   listing (screenshots of the mobile UI, icon from `public/logo.png`).

## Updating

- Web changes: just deploy — the app shows the live site.
- Shell changes (config, plugins, icon): `npx cap sync android`, rebuild the
  bundle, upload to Play.

## Roadmap: offline listening & reading (lease model)

Planned next steps for true offline support, per the Kindle/Audible lease
design:

1. `@capacitor/filesystem` + `@capacitor/preferences` for storing downloaded
   chapters/audio in app-private storage.
2. A `download_leases` concept: each download carries a 30-day lease;
   whenever online the app re-checks `canAccessJournal` and renews or
   removes. Own works never expire; revoked/banned/deleted works are
   removed at sync. Expired-but-unverified leases lock (with a "reconnect
   to verify" notice) rather than delete.
3. Player integration: prefer local files when present, stream otherwise.

## Notes

- The in-app browser shell requires network today; offline arrives with the
  lease work above.
- iOS later: `npm i @capacitor/ios && npx cap add ios` — same shell, but
  App Store review is stricter about wrapper apps; ship Android first.
- The site is also installable as a PWA (manifest is live) — Android users
  who never visit the Play Store can still "Add to Home Screen".
