"use client";

import React, { useState } from "react";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import ViewDetailsMdl from "./ViewDetailsMdl";
import ViewIssuerDetailsMdl from "./ViewIssuerDetailsMdl";

export default function ViewDetailsBtn({ wallet }) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [accountInfo, setAccountInfo] = useState(null);
  const [accountLines, setAccountLines] = useState(null);

  const handleViewDetails = async () => {
    setLoading(true);
    setErrorMessage(null);
    setAccountInfo(null);
    setAccountLines(null);

    try {
      const [infoRes, linesRes] = await Promise.all([
        fetch("/api/wallets/getAccountInfo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet }),
        }),
        fetch("/api/wallets/getAccountLines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet }),
        }),
      ]);

      const infoResult = await infoRes.json();
      const linesResult = await linesRes.json();

      if (!infoRes.ok)
        throw new Error(infoResult.error || "Failed to fetch account info");
      if (!linesRes.ok)
        throw new Error(linesResult.error || "Failed to fetch account lines");

      setAccountInfo(infoResult.data);
      setAccountLines(linesResult.data.lines);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button
        variant="primary"
        onClick={() => {
          handleViewDetails();
          setShowDetails(true);
        }}
      >
        View Details
      </Button>

      {errorMessage && (
        <ErrorMdl
          message={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}

      {showDetails && (
        <div>
          {wallet.walletType === "ISSUER" ? (
            <ViewIssuerDetailsMdl
              infoData={accountInfo}
              linesData={accountLines}
              loading={loading}
              onClose={() => setShowDetails(false)}
            />
          ) : (
            <ViewDetailsMdl
              infoData={accountInfo}
              linesData={accountLines}
              loading={loading}
              onClose={() => setShowDetails(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
