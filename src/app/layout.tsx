import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import {
  THEME_BOOT_SCRIPT,
  ThemeProvider,
} from "@/components/theme-provider";

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
const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://kcals.vercel.app");

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
  icons: { icon: "/logo.svg" },
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
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
