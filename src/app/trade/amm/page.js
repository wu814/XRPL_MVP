"use client";
import Navbar from "@/components/Navbar";
import DisplayAmms from "@/components/Amm/DisplayAmms";
import Breadcrumbs from "@/components/Breadcrumbs";

export default function Trade() {
  return (
    <div>
      <Navbar />
      {/* Main Content */}
      <main className="container mx-auto flex flex-col">
        <Breadcrumbs/>
        <DisplayAmms />
      </main>
    </div>
  );
}
