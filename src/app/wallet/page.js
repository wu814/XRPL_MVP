"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navigation/Navbar";
import DisplayAdminWallets from "@/components/Wallet/DisplayAdminWallets";
import DisplayUserWallets from "@/components/Wallet/DisplayUserWallets";
import UpdateUsernameMdl from "@/components/UpdateUsernameMdl";
import { IssuerWalletProvider } from "@/components/Wallet/IssuerWalletProvider";
import { CurrentUserWalletProvider } from "@/components/Wallet/CurrentUserWalletProvider";

export default function WalletPage() {
  const { data: session, status } = useSession();
  const [username, setUsername] = useState(null);
  const [showUsernameMdl, setShowUsernameMdl] = useState(false);

  // Update username when session is ready
  useEffect(() => {
    if (status === "authenticated") {
      const sessionUsername = session?.user?.username || "";
      setUsername(sessionUsername);

      const fallbackUsername = session?.user?.email;
      if (!sessionUsername || sessionUsername === fallbackUsername) {
        setShowUsernameMdl(true);
      }
    }
  }, [session, status]);

  const isAdmin = session?.user?.is_admin;

  return (
    <div>
      <Navbar username={username} />
      <IssuerWalletProvider>
        <CurrentUserWalletProvider>
          {/* Main Content */}
          <main className="container mx-auto flex">
            {isAdmin ? <DisplayAdminWallets /> : <DisplayUserWallets />}

            {/* Sidebar */}
            <section className="h-[40rem] w-1/3 rounded-lg bg-color2 p-6">
              <h2 className="mb-4 text-center text-2xl font-bold">
                Welcome, {username || "User"}
              </h2>
              <h3 className="mb-4 text-center text-xl font-bold">
                Top Earning Pools (24hr)
              </h3>
              <ul className="space-y-3">
                <li className="flex justify-between rounded-lg bg-color3 p-3">
                  <span>XRP/USD</span>
                  <span>2.75%</span>
                </li>
                <li className="flex justify-between rounded-lg bg-color3 p-3">
                  <span>XRP/BTC</span>
                  <span>1.58%</span>
                </li>
                <li className="flex justify-between rounded-lg bg-color3 p-3">
                  <span>USD/BTC</span>
                  <span>1.23%</span>
                </li>
              </ul>
            </section>
          </main>
        </CurrentUserWalletProvider>
      </IssuerWalletProvider>

      {/* Show modal if needed */}
      {showUsernameMdl && (
        <UpdateUsernameMdl
          onClose={() => setShowUsernameMdl(false)}
          onUpdated={(newName) => setUsername(newName)}
        />
      )}
    </div>
  );
}
