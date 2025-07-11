"use client";
import Sidebar from "@/components/Navigation/Sidebar";
import Topbar from "@/components/Navigation/Topbar";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

export default function ClientLayoutContent({ children }) {
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
    </div>
  );
} 