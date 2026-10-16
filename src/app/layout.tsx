import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { Sidebar, SidebarFallback } from "@/components/sidebar";
import { KeyboardShortcuts, RefreshOnFocus } from "@/components/shell-client";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Todo", template: "%s · Todo" },
  description: "Your Tasks, written and worked on by your agents.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body>
        <div className="flex min-h-dvh flex-col md:flex-row">
          <Suspense fallback={<SidebarFallback />}>
            <Sidebar />
          </Suspense>
          <main className="min-w-0 flex-1">
            <div className="mx-auto w-full max-w-4xl px-4 pt-6 pb-16 sm:px-8 md:pt-10">{children}</div>
          </main>
        </div>
        <KeyboardShortcuts />
        <RefreshOnFocus />
      </body>
    </html>
  );
}
