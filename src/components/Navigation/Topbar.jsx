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
  const getPageTitle = () => {
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

    // Handle profile/friends routes
    if (pathname.startsWith("/friends")) return "Friends";

    // Handle user routes
    if (pathname.startsWith("/user")) return "Profile";

    // Default fallback
    return "Dashboard";
  };

  if (!session) return null;

  return (
    <div className="fixed justify-between left-64 right-0 top-0 z-20 flex h-24 items-center border-b border-gray-700 bg-color2 px-6">
      {/* Page Title */}
      <div className="flex">
        <h1 className="ml-8 text-4xl font-bold text-white">{getPageTitle()}</h1>
      </div>
      <div className="flex flex-row items-center">
        {/* Search Bar */}
          <Searchbar />
        {/* Right side items */}
        <div className="flex items-center space-x-4">
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
}
