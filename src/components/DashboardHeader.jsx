"use client";

import { TrendingUp, ArrowRight } from "lucide-react";

export default function DashboardHeader({ totalBalance, change24h, changePercent }) {
  const isPositive = change24h >= 0;

  return (
    <div className="mb-4">
      <h1 className="text-2xl font-bold mb-2">Dashboard</h1>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-3xl font-bold">
                ${totalBalance ? totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "0.00"}
              </span>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </div>
            <div className={`flex items-center space-x-1 text-sm ${isPositive ? "text-green-400" : "text-red-400"}`}>
              <TrendingUp className="w-3 h-3" />
              <span>
                ${Math.abs(change24h || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} ({changePercent || 0}%) 1D
              </span>
            </div>
          </div>
        </div>

        {/* Mini Chart Placeholder */}
        <div className="w-40 h-12 bg-gray-800 rounded-lg flex items-center justify-center">
          <svg className="w-32 h-10" viewBox="0 0 128 40">
            <polyline
              fill="none"
              stroke={isPositive ? "#10b981" : "#ef4444"}
              strokeWidth="2"
              points="0,32 16,28 32,24 48,20 64,16 80,12 96,8 112,6 128,4"
            />
          </svg>
        </div>
      </div>
    </div>
  );
} 