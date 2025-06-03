"use client";

import { useParams } from "next/navigation";
import Navbar from "@/components/Navigation/Navbar";
import TransferBtn from "@/components/Wallet/TransferBtn";
import AddFriendBtn from "@/components/Friend/AddFriendBtn";
import ErrorMdl from "@/components/ErrorMdl";
import { useWallet } from "@/components/WalletContext";

export default function UserPage() {
  const { username } = useParams(); // this will always reflect the URL param

  const { currentUserWallets, issuerWallets, loading, errorMessage } =
    useWallet();

  return (
    <div>
      <Navbar username={username} />
      <div className="flex flex-col items-center">
        <h1 className="mb-5 text-2xl font-bold">User Profile: {username}</h1>

        <div className="flex flex-row space-x-4">
          {username && currentUserWallets.length > 0 && (
            <TransferBtn
              senderWallet={currentUserWallets[0]} // assumes first is primary
              issuerWallets={issuerWallets}
              presetRecipientUsername={username}
            />
          )}

          <AddFriendBtn receiver={username} />
        </div>

        {errorMessage && (
          <ErrorMdl
            errorMessage={errorMessage}
            onClose={() => {
              /* optional: implement dismissible context error */
            }}
          />
        )}
      </div>
    </div>
  );
}
