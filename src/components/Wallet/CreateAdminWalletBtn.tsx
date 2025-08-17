"use client";

import { useState, FormEvent } from "react";
import { Loader2 } from "lucide-react";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import { APIErrorResponse } from "@/types/api/errorAPITypes";
import { CreateWalletAPIResponse } from "@/types/api/walletAPITypes";


interface CreateAdminWalletBtnProps {
  onWalletCreated: () => void;
}

type WalletType = "ISSUER" | "TREASURY" | "PATHFIND";

export default function CreateAdminWalletBtn({ onWalletCreated }: CreateAdminWalletBtnProps) {
  const [showMdl, setShowMdl] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<WalletType>("ISSUER");

  const handleCreateWallet = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/wallet/createWallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletType }),
      });
      const result: CreateWalletAPIResponse = await response.json();
      if (!response.ok) {
        const errorData: APIErrorResponse = await response.json();
        setErrorMessage(errorData.message);
        return;
      }

      setSuccessMessage(result.message || "Wallet created successfully");

      // Background call to set wallet flags
      setTimeout(async () => {
        try {
          const flagResponse = await fetch("/api/wallet/setWalletFlags", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wallet: result.data }),
          });
          if (!flagResponse.ok) {
            const errorData: APIErrorResponse = await flagResponse.json();
            setErrorMessage(errorData.message);
            return;
          }
        } catch (e: any) {
          setErrorMessage(e.message);
        }
      }, 0);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleCreateWallet();
  };

  return (
    <div>
      <Button
        variant="primary"
        onClick={() => setShowMdl(true)}
        className="mt-4 w-full"
      >
        + Create Wallet
      </Button>

      {showMdl && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
          <div className="w-96 rounded-lg bg-color3 p-6 text-left">
            <h2 className="mb-4 text-2xl font-bold">Create Wallet</h2>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="text-mutedText">Wallet Type</label>
                <select
                  value={walletType}
                  onChange={(e) => setWalletType(e.target.value as WalletType)}
                  className="mt-1 w-full rounded-lg border border-transparent bg-color4 p-2 focus:border-primary focus:outline-none hover:border-gray-500"
                >
                  <option value="ISSUER">Issuer</option>
                  <option value="TREASURY">Treasury</option>
                  <option value="PATHFIND">Pathfind</option>
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
                <Button type="submit" variant="primary" disabled={loading} className="flex-1">
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
            setShowMdl(false); // Close modal after success
          }}
        />
      )}
    </div>
  );
};
