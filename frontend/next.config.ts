import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // The browser only talks to this origin; Next forwards API calls to the backend (first-party cookies, no CORS).
  rewrites: async () => [
    { source: "/api/v1/:path*", destination: `${process.env.API_ORIGIN}/api/v1/:path*` },
  ],
};

export default createNextIntlPlugin()(nextConfig);
