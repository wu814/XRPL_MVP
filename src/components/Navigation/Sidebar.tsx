"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import {
  Home,
  Wallet,
  TrendingUp,
  User,
  Settings,
  Receipt,
  ImageIcon,
  LucideIcon,
} from "lucide-react";

interface NavigationItem {
  name: string;
  icon: LucideIcon;
  path: string;
}

export default function Sidebar() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  if (status === "loading") {
    return (
      <div className="fixed left-0 top-0 h-full w-64 border-r border-gray-700 bg-color2 p-6">
        <div className="animate-pulse">
          <div className="mb-8 h-8 rounded bg-gray-600"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 rounded bg-gray-600"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const user = session.user;
  const navigationItems: NavigationItem[] = [
    {
      name: "Home",
      icon: Home,
      path: "/home",
    },
    {
      name: user.role === "ADMIN" ? "My Wallets" : "My Assets",
      icon: Wallet,
      path: user.role === "ADMIN" ? "/wallets" : "/assets",
    },
    {
      name: "Advanced Trading",
      icon: TrendingUp,
      path: "/trade",
    },
    {
      name: "NFT Marketplace",
      icon: ImageIcon,
      path: "/nft",
    },
    {
      name: "Transactions",
      icon: Receipt,
      path: "/transactions",
    },
    {
      name: "Friends",
      icon: User,
      path: "/friends",
    },
    {
      name: "Settings",
      icon: Settings,
      path: "/settings",
    },
  ];

  return (
    <div className="fixed left-0 top-0 flex h-full w-56 flex-col border-r border-gray-700 bg-color1 p-4">
      {/* Logo */}  
      <div className="flex content-center justify-center pt-5 pb-10">
        <h1 className="text-5xl font-extrabold text-primary">YONA</h1>
      </div>
      {/* Navigation */}
      <nav className="flex-1">
        <ul className="space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.path ||
              (item.path === "/trade" && pathname.startsWith("/trade")) ||
              (item.path.startsWith("/friends") &&
                pathname.startsWith("/friends"));

            return (
              <li key={item.name}>
                <button
                  onClick={() => handleNavigation(item.path)}
                  className={`flex w-full items-center space-x-3 rounded-lg px-3 py-2 transition-colors ${
                    isActive
                      ? "bg-color4 text-white"
                      : "text-gray-400 hover:bg-color3 hover:text-white"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Info */}
      <div className="border-t border-gray-700 pt-4">
        <div className="flex items-center space-x-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-600">
            <User className="h-5 w-5 text-gray-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              Welcome, {user.username}
            </p>
            <p className="text-xs text-gray-400">{user.role}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
