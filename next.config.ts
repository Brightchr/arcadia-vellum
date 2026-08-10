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
};

export default nextConfig;
