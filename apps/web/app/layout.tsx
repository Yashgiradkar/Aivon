import { ClerkProvider } from '@clerk/nextjs'
import { Geist, Geist_Mono } from "next/font/google"
import type { Metadata, Viewport } from "next";

import "@workspace/ui/globals.css"
import { Providers } from "@/components/providers"
import { Toaster } from "@workspace/ui/components/sonner";

export const metadata: Metadata = {
  title: "Aivon — AI Customer Support Dashboard",
  description: "Manage conversations, AI responses, and customer support queues.",
};

export const viewport: Viewport = {
  themeColor: "#3C82F6",
};

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preconnect to Convex to reduce WebSocket handshake latency */}
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_CONVEX_URL ?? ""} />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_CONVEX_URL ?? ""} />
      </head>
      <body
        className={`${fontSans.variable} ${fontMono.variable} font-sans antialiased `}
      >
        <ClerkProvider
          appearance={{
            variables: {
              colorPrimary: "#3C82F6"
            }
          }}
        >
          <Providers>
            <Toaster />
            {children}
          </Providers>
        </ClerkProvider>
      </body>
    </html>
  )
}
