// layout.js
"use client";
import { Inter } from "next/font/google";
import "./globals.css";
import SessionWrapper from "@/components/SessionWrapper";
import Sidebar from "@/components/Navigation/Sidebar";
import SearchBar from "@/components/Navigation/SearchBar";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

function LayoutContent({ children }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  
 // Don't show sidebar on splash page, register page, or when not authenticated
 const showSidebar = session && pathname !== "/" && pathname !== "/register";
  
  return (
    <div className="min-h-screen bg-color1 text-white">
      {showSidebar && <Sidebar />}
      <div className={showSidebar ? "" : ""}>
        {children}
      </div>
    </div>
  );
}

// Metadata moved to head.js or individual pages since this is now a client component

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
