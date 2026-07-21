import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://vexa-fazis-projects-f96b2d55.vercel.app"),
  title: "Vexa — Financial modeling for everyone",
  description:
    "Build a full financial model of any listed company in minutes — 3-statement forecast, DCF, scenarios, sensitivity, capital raising, M&A and LBO. No Excel required.",
  openGraph: {
    title: "Vexa — Financial modeling for everyone",
    description:
      "Type any listed company. Get a full banker-grade model in minutes — DCF, scenarios, M&A, LBO. No Excel required.",
    type: "website",
    siteName: "Vexa",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vexa — Financial modeling for everyone",
    description:
      "Type any listed company. Get a full banker-grade model in minutes — DCF, scenarios, M&A, LBO. No Excel required.",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
