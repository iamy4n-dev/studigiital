import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import "katex/dist/katex.min.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Studigital",
  description: "Capture, transform, and review your learning moments",
};

const devMode = process.env.NEXT_PUBLIC_DEV_MODE === "true";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  if (devMode) {
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    );
  }
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
