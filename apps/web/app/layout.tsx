import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: {
    default: "DesignAI — AI Building Design Platform",
    template: "%s | DesignAI",
  },
  description:
    "Design your building in minutes, not months. Draw a land parcel, get an AI feasibility check, and receive 3 fully-detailed building layout configurations with 3D models and PDF reports.",
  keywords: [
    "architecture AI", "AI building design", "feasibility analysis",
    "3D building layout", "Claude AI architecture", "automated floor plan",
    "building permit", "FSI calculator",
  ],
  authors: [{ name: "DesignAI" }],
  metadataBase: new URL(APP_URL),
  openGraph: {
    title: "DesignAI — AI Building Design Platform",
    description:
      "Design your building in minutes, not months. AI-powered feasibility + 3 layout options + PDF export.",
    type: "website",
    locale: "en_US",
    siteName: "DesignAI",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "DesignAI — AI Building Design Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DesignAI — AI Building Design Platform",
    description: "Design your building in minutes, not months.",
    images: ["/og-image.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Mapbox GL CSS */}
        <link
          href="https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.css"
          rel="stylesheet"
        />
        {/* Leaflet CSS */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
