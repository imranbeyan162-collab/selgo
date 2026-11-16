// web/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Instrument_Serif } from "next/font/google";
import type { ReactNode } from "react";

import { AppDrawer } from "../components/app-drawer";
import "./globals.css";

// The display serif for expert and agent names (like an author's name on a book).
const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-instrument",
});

export const metadata: Metadata = {
  title: "Selgo — AI Agents • Automated for You",
  description: "Selgo AI Business Mentor and ready-made AI agents for your business.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#050811",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={display.variable}>
      <body className="flex h-dvh flex-col overflow-hidden antialiased">
        <AppDrawer />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</main>
      </body>
    </html>
  );
}
