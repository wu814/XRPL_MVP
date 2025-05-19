"use client";
import Navbar from "@/components/Navbar";
import DisplayAmms from "@/components/Amm/DisplayAmms";

export default function Pools() {
  return (
    <div>
      <Navbar />
      {/* Main Content */}
      <main className="container mx-auto flex p-4">
        <DisplayAmms />
      </main>
    </div>
  );
}
