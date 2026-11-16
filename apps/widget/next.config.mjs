const isDev = process.env.NODE_ENV !== "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui"],
  devIndicators: false,
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@workspace/ui",
      "date-fns",
      "jotai",
      "@convex-dev/agent",
    ],
  },
  async headers() {
    const csp = isDev
      ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.convex.site https://api.vapi.ai wss://*.vapi.ai ws: http:; media-src 'self' blob:; frame-ancestors http: https: 'self'; object-src 'none'; base-uri 'self'"
      : "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.convex.site https://api.vapi.ai wss://*.vapi.ai; media-src 'self' blob:; frame-ancestors https:; object-src 'none'; base-uri 'self'";

    return [
      // Security headers applied only to app routes — NOT to /_next/static assets.
      // X-Content-Type-Options: nosniff on /_next/static/css/* causes browsers to
      // reject CSS served without an explicit Content-Type header (dev server issue).
      {
        source: "/((?!_next/).*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          // Widget is embedded in iframes on external pages — allow cross-origin reads
          // but restrict opener access to prevent tab-napping
          { key: "Cross-Origin-Opener-Policy", value: "unsafe-none" },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
          {
            key: "Content-Security-Policy",
            value: csp,
          },
        ],
      },
      // Long-lived immutable cache for hashed static assets
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
