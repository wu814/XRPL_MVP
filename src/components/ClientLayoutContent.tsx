"use client";

import Sidebar from "@/components/navigation/Sidebar";
import Topbar from "@/components/navigation/Topbar";
import TradePanel from "@/components/smart/TradePanel";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

interface ClientLayoutContentProps {
  children: React.ReactNode;
}

export default function ClientLayoutContent({ children }: ClientLayoutContentProps) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  
  // Don't show sidebar/topbar on splash page, register page, or when not authenticated
  const showNavigation = session && pathname !== "/" && pathname !== "/register";
  const showSmartTradePanel = session && pathname !== "/" && pathname !== "/register" && !pathname.startsWith("/trade/amm") && !pathname.startsWith("/user") && pathname !== "/trade/dex" && pathname !== "/settings";
  
  return (
    <div className="min-h-screen bg-color1 text-white">
      {showNavigation && <Topbar />}
      {showNavigation && <Sidebar />}
      <div className={`${showNavigation ? "mt-24 ml-56" : ""} ${showSmartTradePanel ? "mr-[30rem]" : ""}`}>
        {children}
      </div>
      {showSmartTradePanel && <TradePanel />}
    </div>
  );
}
