"use client";

import Image from "next/image";
import Button from "@/components/Button";
import Searchbar from "@/components/Searchbar";
import Navbar from "@/components/Navbar";
import WalletsDisplay from "@/components/WalletsDisplay";
import CreateWalletBtn from "@/components/CreateWalletBtn";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-100">
      
      {/* Top Navigation */}
      <header className="flex items-center justify-between p-4 bg-white shadow">
        <Navbar />
        <Searchbar />
      </header>

      {/* Main Content */}
      <main className="flex p-4">
        <div className="flex-col mr-4 container mx-auto">
          <WalletsDisplay />
          <CreateWalletBtn />
        </div>

        {/* Top Earning Pools Sidebar */}
        <section className="w-1/3 bg-white p-6 rounded-lg shadow">
          <h3 className="text-xl font-bold mb-4">Top Earning Pools (24hr)</h3>
          <ul className="space-y-3">
            <li className="flex justify-between bg-gray-100 p-3 rounded">
              <span>XRP/USD</span>
              <span>2.75%</span>
            </li>
            <li className="flex justify-between bg-gray-100 p-3 rounded">
              <span>XRP/BTC</span>
              <span>1.58%</span>
            </li>
            <li className="flex justify-between bg-gray-100 p-3 rounded">
              <span>USD/BTC</span>
              <span>1.23%</span>
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
