import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { LocaleDbInitializer } from "@/components/locale-db-initializer";
import { VoiceGuideProvider } from "@/components/voice-guide";
import { VoiceCommandPalette } from "@/components/voice-commands";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "NexaFlow - Automate workflows without the chaos",
  description: "NexaFlow connects your tools, orchestrates your pipelines, and gives your team superpowers.",
  other: {
    "app-mode": process.env.NEXT_PUBLIC_APP_MODE ?? "dev",
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={cn("font-sans antialiased h-full", inter.variable)}>
      <body className="min-h-screen h-full bg-background text-foreground">
        <LocaleDbInitializer />
        <VoiceGuideProvider>
          {children}
          <VoiceCommandPalette />
        </VoiceGuideProvider>
      </body>
    </html>
  );
}
