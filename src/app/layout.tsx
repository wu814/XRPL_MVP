// layout.tsx
import React, { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import SessionWrapper from "@/components/SessionWrapper";
import ClientLayoutContent from "@/components/ClientLayoutContent";
import IssuerWalletProvider from "@/components/wallet/IssuerWalletProvider";
import CurrentUserWalletProvider from "@/components/wallet/CurrentUserWalletProvider";
import { Metadata } from "next";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Default metadata for SEO, social sharing, and fallback
export const metadata: Metadata = {
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

interface RootLayoutProps {
  children: ReactNode;
}

const RootLayout: React.FC<RootLayoutProps> = ({ children }) => {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <SessionWrapper>
          <CurrentUserWalletProvider>
            <IssuerWalletProvider>
              <ClientLayoutContent>{children}</ClientLayoutContent>
            </IssuerWalletProvider>
          </CurrentUserWalletProvider>
        </SessionWrapper>
      </body>
    </html>
  );
};

export default RootLayout;
