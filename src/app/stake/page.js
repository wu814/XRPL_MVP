"use client";
import Navbar from "@/components/Navbar";
import DisplayAmms from "@/components/Stake/DisplayAmms";

export default function Stake() {
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
