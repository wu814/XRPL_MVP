"use client";

import { ArrowRight } from "lucide-react";

export default function DashboardHeader({ totalBalance, change24h, changePercent }) {
  const isPositive = change24h >= 0;

  return (
    <div className="mb-4 p-4">
      <h1 className="text-2xl font-bold mb-2">Dashboard</h1>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <span className="text-4xl font-bold">
                ${totalBalance ? totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "0.00"}
              </span>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </div>
        </div>
      </div>
    </div>
  );
} 