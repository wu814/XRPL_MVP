"use client";

import { useParams } from "next/navigation";
import TransferBtn from "@/components/wallet/TransferBtn";
import AddFriendBtn from "@/components/friend/AddFriendBtn";
import ErrorMdl from "@/components/ErrorMdl";
import { useCurrentUserWallet } from "@/components/wallet/CurrentUserWalletProvider";
import { useIssuerWallet } from "@/components/wallet/IssuerWalletProvider";
import { useState, useEffect } from "react";
import usePageTitle from "@/utils/usePageTitle";

export default function UserPage(){
  const { username } = useParams<{ username: string }>();

  const { currentUserWallets, errorMessage: userWalletsErrorMessage } = useCurrentUserWallet();
  const { issuerWallets, errorMessage: issuerWalletsErrorMessage } = useIssuerWallet();

  const loadWalletErrorMessage: string | null =
    userWalletsErrorMessage || issuerWalletsErrorMessage;

  const [errorMessage, setErrorMessage] = useState<string | null>(loadWalletErrorMessage);
  
  // Set page title with username
  usePageTitle(`${username} - Profile - YONA`);
  
  useEffect(() => {
    if (loadWalletErrorMessage) {
      setErrorMessage(loadWalletErrorMessage);
    }
  }, [loadWalletErrorMessage]);

  return (
    <div className="p-8">
      <div className="flex flex-col items-center">
        <h1 className="mb-5 text-4xl font-bold">User Profile: {username}</h1>

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
