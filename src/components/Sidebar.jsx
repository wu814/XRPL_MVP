"use client"

import { useState, useEffect } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import { Home, Wallet, TrendingUp, User, Settings, LogOut, ChevronDown, Receipt } from "lucide-react"

export default function Sidebar() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [activeTab, setActiveTab] = useState("Home")

  // Determine active tab based on current path and query params
  useEffect(() => {
    if (pathname === "/wallet") {
      const urlParams = new URLSearchParams(window.location.search)
      const tab = urlParams.get('tab')
      if (tab === 'assets') {
        setActiveTab(session?.user?.is_admin ? "My Wallets" : "My Assets")
      } else if (tab === 'transactions') {
        setActiveTab("Transactions")
      } else {
        setActiveTab("Home")
      }
    } else if (pathname.startsWith("/trade")) {
      setActiveTab("Advanced Trading")
    } else if (pathname.startsWith("/profile")) {
      setActiveTab("Friends")
    } else if (pathname.startsWith("/settings")) {
      setActiveTab("Settings")
    }
  }, [pathname, session])

  const handleNavigation = (tab, path, queryParams = null) => {
    setActiveTab(tab)
    if (queryParams) {
      router.push(`${path}?${queryParams}`)
    } else {
      router.push(path)
    }
  }

  const handleLogout = async () => {
    await signOut({ redirect: false })
    router.push("/")
  }

  if (status === "loading") {
    return (
      <div className="w-64 fixed left-0 top-0 h-full bg-color2 border-r border-gray-700 p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-600 rounded mb-8"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-gray-600 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!session) return null

  const navigationItems = [
    {
      name: "Home",
      icon: Home,
      path: "/wallet",
      queryParams: null
    },
    {
      name: session.user.is_admin ? "My Wallets" : "My Assets",
      icon: Wallet,
      path: "/wallet",
      queryParams: "tab=assets"
    },
    {
      name: "Transactions",
      icon: Receipt,
      path: "/wallet",
      queryParams: "tab=transactions"
    },
    {
      name: "Advanced Trading",
      icon: TrendingUp,
      path: "/trade"
    },
    {
      name: "Friends",
      icon: User,
      path: `/profile/${session.user.username}`
    },
    {
      name: "Settings",
      icon: Settings,
      path: "/settings"
    }
  ]

  return (
    <div className="w-64 fixed left-0 top-0 h-full bg-color2 border-r border-gray-700 p-6 flex flex-col">
      {/* Logo */}
      <div className="flex items-center space-x-2 mb-8">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">X</span>
        </div>
        <span className="text-white font-bold text-lg">XRPL MVP</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1">
        <ul className="space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.name
            
            return (
              <li key={item.name}>
                <button
                  onClick={() => handleNavigation(item.name, item.path, item.queryParams)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-gray-300 hover:bg-color3 hover:text-white"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User Info */}
      <div className="border-t border-gray-700 pt-4">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-gray-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              Welcome, {session.user.username}
            </p>
            <p className="text-xs text-gray-400">
              {session.user.is_admin ? "Admin" : "User"}
            </p>
          </div>
        </div>
        
        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-red-600 hover:text-white transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Log Out</span>
        </button>
      </div>
    </div>
  )
} 