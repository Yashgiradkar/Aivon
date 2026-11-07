import { withSentryConfig } from "@sentry/nextjs";
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui"],
  devIndicators: false,
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  // Prevent heavy server-side packages from being bundled into edge runtime
  serverExternalPackages: ["bowser"],
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@workspace/ui",
      "date-fns",
      "jotai",
      "@convex-dev/agent",
      "@convex-dev/rag",
      "countries-and-timezones",
    ],
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/conversations",
        permanent: false,
      },
    ];
  },
  async headers() {
    const clerkUrl =
      process.env.NEXT_PUBLIC_CLERK_FRONTEND_API_URL ||
      "https://clerk.accounts.dev";
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "off",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Strict-Transport-Security",
            // SEC-09: added 'preload' directive for HSTS preload list submission
            value: "max-age=31536000; includeSubDomains; preload",
          },
          // SEC-10: Cross-Origin isolation headers
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Dynamic code evaluation removed (SEC-01): Next.js + Clerk do not require eval at runtime.
              // 'unsafe-inline' retained for Clerk component styling compatibility.
              `script-src 'self' 'unsafe-inline' ${clerkUrl} https://*.clerk.accounts.dev https://challenges.cloudflare.com`,
              `connect-src 'self' ${clerkUrl} https://*.clerk.accounts.dev ${process.env.NEXT_PUBLIC_CONVEX_URL ?? ""} https://*.convex.cloud https://*.convex.site wss://*.convex.cloud https://*.sentry.io`,
              "img-src 'self' data: blob: https:",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' data:",
              `frame-src ${clerkUrl} https://*.clerk.accounts.dev https://challenges.cloudflare.com`,
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
            ].join("; "),
          },
          {
            key: "Link",
            value: `<${clerkUrl}>; rel=preconnect`,
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

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "aivon-2t",

  project: "aivon-errors",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
