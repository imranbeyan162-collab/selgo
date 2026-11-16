// web/app/layout.tsx
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { AppDrawer } from "../components/app-drawer";
import "./globals.css";

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
    <html lang="en">
      <body className="flex h-dvh flex-col overflow-hidden antialiased">
        <AppDrawer />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</main>
      </body>
    </html>
  );
}
