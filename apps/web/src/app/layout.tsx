import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: {
    default: "Layoutcraft Studio — 3D interior design and quoting",
    template: "%s · Layoutcraft Studio",
  },
  description:
    "Draw a flat, furnish it in seconds, walk the client through it in 3D, and send a priced quotation from the same drawing. Built for interior design studios.",
  openGraph: {
    title: "Layoutcraft Studio",
    description:
      "Plan, render and quote an interior fit-out from one drawing. Built for interior design studios.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e9ece9" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1516" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
