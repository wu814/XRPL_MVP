"use client";
import Navbar from "@/components/Navigation/Navbar";
import DisplayAmms from "@/components/Amm/DisplayAmms";
import Breadcrumbs from "@/components/Navigation/Breadcrumbs";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function AMM() {
  const { data: session, status } = useSession();
  const [username, setUsername] = useState(null);

  useEffect(() => {
    if (status === "authenticated") {
      setUsername(session.user.username || "");
    }
  }, [session, status]);


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
