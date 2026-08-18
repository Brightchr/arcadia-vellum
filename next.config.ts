import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // vellum-books.org is the canonical home; requests reaching the service
  // through the Railway subdomain bounce there so cookies, bookmarks, and
  // search results never split across two hosts.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "arcadia-vellum.up.railway.app" }],
        destination: "https://vellum-books.org/:path*",
        permanent: true,
      },
    ];
  },
  // Baseline security headers. The CSP is deliberately pragmatic: inline
  // styles/scripts stay allowed (Next runtime + flipbook need them), external
  // loads are pinned to self, the bucket redirects (https:), and Turnstile.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "media-src 'self' blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https:",
              "frame-src https://challenges.cloudflare.com https://accounts.google.com",
              "object-src 'none'",
              "base-uri 'self'",
              "frame-ancestors 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
