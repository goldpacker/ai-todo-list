import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Sans, JetBrains_Mono } from "next/font/google";
import { Suspense } from "react";
import { TopBar, TopBarFallback } from "@/components/top-bar";
import { KeyboardShortcuts, RefreshOnFocus } from "@/components/shell-client";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["500", "700", "800"],
});
const sans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["500"] });

export const metadata: Metadata = {
  title: { default: "todo", template: "%s · todo" },
  description: "Your Tasks, written and worked on by your agents.",
};

export const viewport: Viewport = { themeColor: "#181825", colorScheme: "dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable} antialiased`}>
      <body className="min-h-dvh">
        <Suspense fallback={<TopBarFallback />}>
          <TopBar />
        </Suspense>
        <main className="mx-auto w-full max-w-[1400px] px-4 pt-6 pb-16 sm:px-8 sm:pt-8">{children}</main>
        <KeyboardShortcuts />
        <RefreshOnFocus />
      </body>
    </html>
  );
}
