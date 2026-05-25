import type { Metadata } from "next";
import { Suspense, ViewTransition } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import {
  THEME_BOOT_SCRIPT,
  ThemeProvider,
} from "@/components/theme-provider";
import { NavProgress } from "@/components/nav-progress";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { getSiteUrl } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Public URL used by social-card crawlers (Slack, iMessage, Twitter, etc.)
// to resolve relative paths in og:image / twitter:image.
const siteUrl = getSiteUrl();

const title = "kcals — a beautifully simple calorie tracker";
const description =
  "Track meals, hit your goals, share progress with the people you eat with. Free, fast, and minimal.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s · kcals",
  },
  description,
  applicationName: "kcals",
  keywords: [
    "calorie tracker",
    "macro tracker",
    "weight tracking",
    "TDEE calculator",
    "BMR calculator",
    "nutrition log",
    "food log",
    "USDA food database",
  ],
  authors: [{ name: "kcals" }],
  creator: "kcals",
  // Icons handled by app/icon.tsx + app/apple-icon.tsx file conventions.
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "kcals",
    // Translucent status bar so our ambient gradient bleeds into it on iOS.
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    siteName: "kcals",
    url: siteUrl,
    title,
    description,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  // Prevents accidental pinch-zoom on input focus on iOS — feels app-like.
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Blocks paint until the theme class is on <html> — prevents
            light/dark flash on first load. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        <ThemeProvider>
          <ViewTransition
            enter={{
              "nav-forward": "nav-forward",
              "nav-back": "nav-back",
              default: "fade",
            }}
            exit={{
              "nav-forward": "nav-forward",
              "nav-back": "nav-back",
              default: "fade",
            }}
            default="none"
          >
            {children}
          </ViewTransition>
        </ThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
