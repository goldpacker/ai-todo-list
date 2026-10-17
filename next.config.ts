import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components stays on: nothing is cached with "use cache", and every data read goes through
  // `readCore()` (src/lib/core.ts), which awaits `connection()` so SQLite is only read at request time.
  cacheComponents: true,
  partialPrefetching: true,
  // better-sqlite3 is a native addon; load it with Node's require instead of bundling it.
  serverExternalPackages: ["better-sqlite3"],
  // The Lanes board became the home page; keep old /lanes links working.
  redirects: async () => [{ source: "/lanes", destination: "/", permanent: false }],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
