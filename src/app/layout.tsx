import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const bodySans = Geist({
  variable: "--font-body-sans",
  subsets: ["latin"],
});

const displaySerif = Fraunces({
  variable: "--font-display-serif",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aperture",
  description: "Self-hosted movie library manager.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Aperture",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${bodySans.variable} ${displaySerif.variable} ${geistMono.variable} min-h-screen bg-background text-foreground antialiased`}
      >
        {/* Experimental badge indicating playback is experimental on this branch */}
        <div className="fixed top-4 right-4 z-50">
          <div className="inline-flex items-center gap-2 rounded-md bg-amber-400/95 text-black px-3 py-1 text-xs font-semibold shadow">
            Experimental — playback
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
