"use client";
import DisplayAMMs from "@/components/amm/DisplayAMMs";
import Breadcrumbs from "@/components/navigation/Breadcrumbs";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import usePageTitle from "@/utils/usePageTitle";


export default function AMM() {
  const { data: session, status } = useSession();
  
  // Set page title
  usePageTitle("Liquidity Pools - YONA");

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-color1 p-8 ">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-600 rounded w-48 mb-8"></div>
          <div className="h-32 bg-gray-600 rounded mb-6"></div>
          <div className="h-64 bg-gray-600 rounded"></div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-color1 p-8 ">
        <div className="text-center py-20">
          <h1 className="text-2xl font-bold text-gray-400">Please log in to access liquidity pools</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-color1 p-2 ">
      {/* Breadcrumbs */}
      <div className="m-2">
        <Breadcrumbs />
      </div>

      {/* Main Content - Full Width */}
      <div className="w-full">
        <DisplayAMMs />
      </div>
    </div>
  );
}
