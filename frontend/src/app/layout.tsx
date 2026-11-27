import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MotionProvider, SpotlightTracker } from "@/components/ui/motion";
import { ThemeWatcher } from "@/components/ui/theme-toggle";
import { themeScript } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "WeHire | Staff Workspace", template: "%s | WeHire" },
  description: "WeHire staff sign-in and assigned recruitment workspace",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f2f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0a0e" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-mode is corrected by themeScript before first paint, hence suppressHydrationWarning.
    <html
      lang="en"
      data-mode="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <div aria-hidden className="ambient"><span className="orb orb-1" /><span className="orb orb-2" /><span className="orb orb-3" /><span className="orb orb-4" /></div>
        <ThemeWatcher />
        <SpotlightTracker />
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
