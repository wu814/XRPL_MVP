"use client";
import Navbar from "@/components/Navbar";
import DisplayAmms from "@/components/Amm/DisplayAmms";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function AMM() {
  const { data: session, status } = useSession();
  const [username, setUsername] = useState(null);

  const fetchUsername = async () => {
    if (status !== "authenticated") return;
    try {
      const res = await fetch("/api/users/getUsernameByUserID");
      if (!res.ok) throw new Error("Couldn’t load username");
      const { username: fetched } = await res.json();
      setUsername(fetched);
    } catch (error) {
      console.error("Error fetching username:", error);
      setUsername("");
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchUsername();
    }
  }, [status]);

  return (
    <div>
      <Navbar username={username}/>
      {/* Main Content */}
      <main className="container mx-auto flex flex-col">
        <Breadcrumbs/>
        <DisplayAmms />
      </main>
    </div>
  );
}
