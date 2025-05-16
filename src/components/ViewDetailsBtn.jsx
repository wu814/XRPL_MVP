"use client";

import React, { useState } from "react";
import Button from "./Button";
import ErrorModal from "./ErrorMdl";
import ViewDetailsMdl from "./ViewDetailsMdl";
import ViewIssuerDetailsMdl from "./ViewIssuerDetailsMdl";
import { getAccountInfo, getAccountLines } from "@/utils/xrpl/getWalletInfo";


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
      const info = await getAccountInfo(wallet.classicAddress);
      const lines = await getAccountLines(wallet.classicAddress);
      setAccountInfo(info);
      setAccountLines(lines);
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
        <ErrorModal
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
