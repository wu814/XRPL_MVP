// layout.js
import { Inter } from "next/font/google";
import "./globals.css";
import SessionWrapper from "@/components/SessionWrapper";
import ClientLayoutContent from "@/components/ClientLayoutContent";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Default metadata for SEO, social sharing, and fallback
export const metadata = {
  description: "Trade, manage assets, and interact with the XRPL network",
  keywords: "XRPL, DeFi, trading, cryptocurrency, liquidity pools, AMM, DEX",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "YONA - Your DeFi Platform",
    description: "Trade, manage assets, and interact with the XRPL network",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <SessionWrapper>
          <ClientLayoutContent>{children}</ClientLayoutContent>
        </SessionWrapper>
      </body>
    </html>
  );
}
