"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import { YONAWallet } from "@/types/appTypes";

interface OracleResponse {
  message?: string;
  error?: string;
}

interface ManageOracleBtnProps {
  treasuryWallet: YONAWallet;
  onSuccess?: () => void;
}

type ActiveTab = "Set" | "Delete";

export default function ManageOracleBtn({ treasuryWallet, onSuccess }: ManageOracleBtnProps) {
  const [showMdl, setShowMdl] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("Set");
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form states
  const [oracleDocumentID, setOracleDocumentID] = useState<string>("");
  const [coinGeckoIDs] = useState<string>("ripple,bitcoin,ethereum,euro-coin,solana");
  const [vsCurrency] = useState<string>("usd");

  const handleSetOracle = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/oracle/oracleSet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          treasuryWallet,
          oracleDocumentID: parseInt(oracleDocumentID),
          coinGeckoIDs: coinGeckoIDs.split(",").map(id => id.trim()),
          vsCurrency,
        }),
      });

      const result: OracleResponse = await res.json();
      if (!res.ok)
        throw new Error(result.error || "Failed to set oracle");

      setSuccessMessage(result.message || "Oracle set successfully!");
      
      // Call the onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
      setShowMdl(false);
      setOracleDocumentID("");
    }
  };

  const handleDeleteOracle = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/oracle/oracleDelete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          treasuryWallet,
          oracleDocumentID: parseInt(oracleDocumentID),
        }),
      });

      const result: OracleResponse = await res.json();
      if (!res.ok)
        throw new Error(result.error || "Failed to delete oracle");

      setSuccessMessage(result.message || "Oracle deleted successfully!");
      
      // Call the onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
      setShowMdl(false);
      setOracleDocumentID("");
    }
  };

  return (
    <div>
      <Button variant="primary" onClick={() => setShowMdl(true)}>
        Manage Oracle
      </Button>

      {showMdl && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
          <div className="w-96 rounded-lg bg-color3 p-6">
            <h2 className="mb-4 text-2xl font-semibold">
              Manage Oracle
            </h2>

            {/* Toggle between Set and Delete */}
            <div className="flex bg-color4 rounded-lg p-1 mb-6">
              {(["Set", "Delete"] as ActiveTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 px-3 rounded-md font-semibold text-md ${
                    activeTab === tab
                      ? "bg-primary/20 text-primary border border-primary"
                      : "text-gray-300 hover:text-white"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Oracle Document ID - Common for both operations */}
            <div className="mb-4">
              <label className="mb-1 block text-mutedText text-sm">
                Oracle Document ID
              </label>
              <input
                type="number"
                value={oracleDocumentID}
                onChange={(e) => setOracleDocumentID(e.target.value)}
                className="bg-color4 w-full rounded-lg border border-transparent p-2 hover:border-gray-500 focus:border-primary focus:outline-none"
                placeholder="Enter Oracle Document ID"
              />
            </div>

            {/* Set Oracle Fields */}
            {activeTab === "Set" && (
              <>
                <div className="mb-4">
                  <label className="mb-1 block text-mutedText text-sm">
                    CoinGecko IDs (Read-only)
                  </label>
                  <input
                    type="text"
                    value={coinGeckoIDs}
                    disabled
                    className="bg-color4 w-full rounded-lg border border-transparent p-2 opacity-60 cursor-not-allowed"
                  />
                </div>

                <div className="mb-4">
                  <label className="mb-1 block text-mutedText text-sm">
                    VS Currency (Read-only)
                  </label>
                  <input
                    type="text"
                    value={vsCurrency}
                    disabled
                    className="bg-color4 w-full rounded-lg border border-transparent p-2 opacity-60 cursor-not-allowed"
                  />
                </div>
              </>
            )}

            {/* Action Buttons */}
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
                variant="primary"
                onClick={activeTab === "Set" ? handleSetOracle : handleDeleteOracle}
                disabled={loading || !oracleDocumentID}
                className="flex-1"
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>{activeTab === "Set" ? "Setting..." : "Deleting..."}</span>
                  </div>
                ) : (
                  activeTab === "Set" ? "Set Oracle" : "Delete Oracle"
                )}
              </Button>
            </div>
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
          onClose={() => setSuccessMessage(null)}
        />
      )}
    </div>
  );
};
