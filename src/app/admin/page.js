"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import AdminWalletsDisplay from "@/components/Admin/AdminWalletsDisplay";
import UpdateUsernameModal from "@/components/UpdateUsernameMdl";

export default function AdminHome() {
  const { data: session, status } = useSession();
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [username, setUsername] = useState(null);

  const fetchUsername = async () => {
    if (status !== "authenticated") return;
    try {
      const res = await fetch("/api/users/getUsernameByEmail");
      if (!res.ok) throw new Error("Couldn’t load username");
      const { username: fetched } = await res.json();
      setUsername(fetched);
      // if they’re still using their email as a username, prompt them
      setShowUsernameModal(fetched === session.user.email);
    } catch {
      setUsername("");
      setShowUsernameModal(true);
    }
  };

  // Kick off the first fetch as soon as we know we're authenticated
  useEffect(() => {
    fetchUsername();
  }, [status, session?.user?.email]);

  return (
    <div>
      <Navbar />
      {/* Main Content */}
      <main className="container mx-auto flex p-4">
        <AdminWalletsDisplay />

        {/* Top Earning Pools Sidebar */}
        <section className="h-[40rem] w-1/3 rounded-lg bg-[#242639] p-6 shadow-lg">
          <h2 className="mb-4 text-2xl font-bold">
            Welcome, {username || "User"}
          </h2>
          <h3 className="mb-4 text-xl font-bold">Top Earning Pools (24hr)</h3>
          <ul className="space-y-3">
            <li className="flex justify-between rounded bg-[#2C2E44] p-3">
              <span>XRP/USD</span>
              <span>2.75%</span>
            </li>
            <li className="flex justify-between rounded bg-[#2C2E44] p-3">
              <span>XRP/BTC</span>
              <span>1.58%</span>
            </li>
            <li className="flex justify-between rounded bg-[#2C2E44] p-3">
              <span>USD/BTC</span>
              <span>1.23%</span>
            </li>
          </ul>
        </section>
      </main>
      {showUsernameModal && (
        <UpdateUsernameModal
          onClose={() => setShowUsernameModal(false)}
          onUpdated={fetchUsername}
        />
      )}
      {/* Footer */}
    </div>
  );
}
