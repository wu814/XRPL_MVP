"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import Button from "@/components/Button";
import Navbar from "@/components/Navbar";
import AdminWalletsDisplay from "@/components/Admin/AdminWalletsDisplay";
import UpdateUsernameModal from "@/components/UpdateUsernameModal";

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
        <div className="min-h-screen bg-gray-100">

            {/* Top Navigation */}
            <header className="p-4 bg-white shadow">
                <Navbar />
            </header>

            {/* Main Content */}
            <main className="container mx-auto p-4 flex">
                <AdminWalletsDisplay />

                {/* Top Earning Pools Sidebar */}
                <section className="w-1/3 bg-white p-6 rounded-lg shadow">
                    <h2 className="text-2xl font-bold mb-4">Welcome, {username || "User"}</h2>
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
