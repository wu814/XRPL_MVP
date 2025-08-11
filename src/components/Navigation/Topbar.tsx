"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { Bell, LogOut } from "lucide-react";
import Searchbar from "./Searchbar";


export default function Topbar() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push("/");
  };

  // Function to get the current page title based on pathname
  const getPageTitle = (): string => {
    if (!session) return "";

    // Handle specific routes
    if (pathname === "/home") return "Home";
    if (pathname === "/assets") return "My Assets";
    if (pathname === "/wallets" || pathname === "/wallet") return "My Wallets";
    if (pathname === "/transactions") return "Transactions";
    if (pathname === "/settings") return "Settings";
    if (pathname === "/nft") return "NFT";

    // Handle trade routes
    if (pathname.startsWith("/trade")) {
      if (pathname === "/trade") return "Advanced Trading";
      if (pathname.startsWith("/trade/amm")) return "Liquidity Pool";
      if (pathname.startsWith("/trade/dex")) return "Order Book";
      return "Advanced Trading";
    }

    // Handle friends routes
    if (pathname.startsWith("/friends")) return "Friends";

    // Handle when user search for a user
    if (pathname.startsWith("/user")) return "Search Result";

    // Default fallback
    return "Dashboard";
  };

  if (!session) return null;

  return (
    <div className="fixed left-56 right-0 top-0 z-20 grid grid-cols-2 h-24 items-center border-b border-gray-700 bg-color1 px-6">
      {/* Page Title */}
      <div className="col-span-1">  
        <h1 className="ml-5 text-3xl font-bold text-white">{getPageTitle()}</h1>
      </div>
      <div className="col-span-1 flex flex-row items-center">
        {/* Search Bar */}
        <div className="flex flex-1 items-center space-x-4">
          <Searchbar />
        </div>
        <div className="flex items-center space-x-4">
          {/* Right side items */}
            {/* Notification Bell */}
            <button className="rounded-lg p-2 text-gray-300 transition-colors hover:bg-color3 hover:text-white">
              <Bell className="h-7 w-7" />
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 rounded-lg px-3 py-2 text-gray-300 transition-colors hover:bg-red-600 hover:text-white"
            >
              <LogOut className="h-7 w-7" />
              <span>Log Out</span>
            </button>
        </div>
      </div>
    </div>
  );
};
