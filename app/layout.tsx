import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/providers";

export const metadata: Metadata = {
  title: "PACCE — Real-time IPL Player Auction",
  description: "Host your private IPL player auction with friends. Real-time bidding, live leaderboards, squad building.",
  keywords: "IPL auction, cricket, fantasy, bidding, multiplayer",
  openGraph: {
    title: "PACCE",
    description: "Real-time IPL fantasy cricket auction",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
