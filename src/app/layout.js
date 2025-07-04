// layout.js
"use client";
import { Inter } from "next/font/google";
import "./globals.css";
import SessionWrapper from "@/components/SessionWrapper";
import Sidebar from "@/components/Navigation/Sidebar";
import Topbar from "@/components/Navigation/Topbar";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

function LayoutContent({ children }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  
  // Don't show sidebar/topbar on splash page, register page, or when not authenticated
  const showNavigation = session && pathname !== "/" && pathname !== "/register";
  const showSmartTradePanel = session && !pathname.startsWith("/trade/amm") && !pathname.startsWith("/user") && pathname !== "/trade/dex" && pathname !== "/settings";
  
  return (
    <div className="min-h-screen bg-color1 text-white">
      {showNavigation && <Topbar />}
      {showNavigation && <Sidebar />}
      <div className={`${showNavigation ? "pt-24 pl-64" : ""} ${showSmartTradePanel ? "pr-[32rem]" : ""}`}>
        {children}
      </div>
    </div>
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <SessionWrapper>
          <LayoutContent>{children}</LayoutContent>
        </SessionWrapper>
      </body>
    </html>
  );
}
