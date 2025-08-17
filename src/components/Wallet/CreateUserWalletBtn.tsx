"use client";

import { useState, FormEvent } from "react";
import { Loader2 } from "lucide-react";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import { useSession } from "next-auth/react";
import { APIErrorResponse } from "@/types/api/errorAPITypes";
import { CreateWalletAPIResponse } from "@/types/api/walletAPITypes";


interface CreateUserWalletBtnProps {
  onWalletCreated: () => void;
}

export default function CreateUserWalletBtn({ onWalletCreated }: CreateUserWalletBtnProps) {
  const [showMdl, setShowMdl] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [method, setMethod] = useState<string>("custodial");

  const { data: session } = useSession();

  const handleCreateWallet = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/wallet/createWallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletType: session?.user.role }),
      });

      const result: CreateWalletAPIResponse = await response.json();
      if (!response.ok) {
        const errorData: APIErrorResponse = await response.json();
        setErrorMessage(errorData.message);
        return;
      }

      setSuccessMessage(result.message || "Wallet created successfully");
      
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (method === "custodial") {
      handleCreateWallet();
    }
  };

  return (
    <div>
      <Button
        variant="primary"
        onClick={() => setShowMdl(true)}
        className="hover:scale-none mt-4 w-full"
      >
        + Create / Import Wallet
      </Button>

      {showMdl && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
          <div className="w-96 rounded-lg bg-color3 p-6">
            <h2 className="mb-4 text-xl font-bold">Create / Import Wallet</h2>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="text-mutedText">Wallet Type</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-transparent bg-color4 p-2 focus:border-primary focus:outline-none hover:border-gray-500"
                >
                  <option value="custodial">Custodial Wallet</option>
                  <option value="import">Import Non-Custodial Wallet</option>
                </select>
              </div>

              <div className="flex space-x-2">
                <Button
                  variant="cancel"
                  onClick={() => setShowMdl(false)}
                  disabled={loading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={loading || method !== "custodial"}
                  className="flex-1"
                >
                  {loading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Creating...</span>
                    </div>
                  ) : (
                    "Add Wallet"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {errorMessage && (
        <ErrorMdl
          errorMessage={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}

      {successMessage && (
        <SuccessMdl
          successMessage={successMessage}
          onClose={() => {
            setSuccessMessage(null);
            onWalletCreated(); // Notify parent component
            setShowMdl(false);
          }}
        />
      )}
    </div>
  );
};
