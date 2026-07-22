import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://vexa-fazis-projects-f96b2d55.vercel.app"),
  title: "Vexa — Financial modeling for everyone",
  description:
    "A free tool for learning financial modeling. Type any company and build a full valuation — 3-statement model, DCF, scenarios, sensitivity, capital raising, M&A and LBO — with each step explained.",
  openGraph: {
    title: "Vexa — Financial modeling for everyone",
    description:
      "Type any company and build a full valuation in minutes — DCF, scenarios, M&A, LBO. Free, and it explains each step.",
    type: "website",
    siteName: "Vexa",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vexa — Financial modeling for everyone",
    description:
      "Type any company and build a full valuation in minutes — DCF, scenarios, M&A, LBO. Free, and it explains each step.",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
