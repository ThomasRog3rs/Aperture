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
      <head>
        {/* viewport-fit=cover extends the webview to physical screen edges (under notch/Dynamic Island) on iOS */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        {/* Apple PWA meta tags — when added to Home Screen the app behaves like native */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {/* Android chrome toolbar colour */}
        <meta name="theme-color" content="#000000" />
      </head>
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
