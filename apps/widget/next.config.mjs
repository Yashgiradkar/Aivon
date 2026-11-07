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
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            // SEC-09: added preload to HSTS
            value: "max-age=31536000; includeSubDomains; preload",
          },
          // SEC-10: Widget is embedded in iframes on external pages — allow cross-origin reads
          // but restrict opener access to prevent tab-napping
          { key: "Cross-Origin-Opener-Policy", value: "unsafe-none" },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
          {
            key: "Content-Security-Policy",
            value:
              // SEC-02: Restrict frame-ancestors to HTTPS origins only (was '*').
              // This prevents the widget from being embedded on plain HTTP or data: origins
              // while still allowing any legitimate HTTPS site to embed it.
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.convex.site https://api.vapi.ai wss://*.vapi.ai; media-src 'self' blob:; frame-ancestors https:; object-src 'none'; base-uri 'self'",
          },
        ],
      },
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
