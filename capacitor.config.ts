import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Thin-shell setup: the Android app is a native wrapper around the live
 * site, so the web codebase stays the only codebase. Set server.url to the
 * production origin before building (see docs/ANDROID.md).
 */
const config: CapacitorConfig = {
  appId: "com.arcadia.vellum",
  appName: "Vellum",
  // Unused while server.url points at the live site, but must exist.
  webDir: "public",
  server: {
    // TODO: replace with your Railway production URL before `npx cap sync`.
    url: "https://REPLACE-WITH-YOUR-DOMAIN",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
