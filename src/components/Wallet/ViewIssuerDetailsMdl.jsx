"use client";

import React from "react";
import Button from "../Button";

export default function ViewIssuerDetailsMdl({
  infoData,
  linesData,
  loading,
  onClose,
}) {
  // Group and sum balances by currency
  const groupedBalances =
    linesData?.reduce((acc, line) => {
      const currency = line.currency;
      const balance = parseFloat(line.balance);

      if (!acc[currency]) {
        acc[currency] = 0;
      }
      acc[currency] += balance;
      return acc;
    }, {}) || {};

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/10">
      <div className="relative w-11/12 max-w-3xl overflow-y-auto rounded-lg bg-[#3F4359] p-6 shadow-lg">
        <h2 className="mb-4 text-center text-xl font-bold">
          Issuer Wallet Details
        </h2>

        {/* Loading */}
        {loading && <p className="text-center text-gray-300">Loading...</p>}

        {/* Account Info */}
        {!loading && infoData && (
          <div className="mb-6">
            <h3 className="mb-2 text-lg font-semibold">Account Info</h3>
            <ul className="space-y-1 text-sm">
              <li>
                <strong>Address:</strong> {infoData.address}
              </li>
              <li>
                <strong>Sequence:</strong> {infoData.sequence}
              </li>
              <li>
                <strong>Balance:</strong> {infoData.balance} XRP
              </li>
              <li>
                <strong>Owner Count:</strong> {infoData.ownerCount}
              </li>
              <li>
                <strong>Enabled Flags:</strong> {infoData.enabledFlags}
              </li>
            </ul>
          </div>
        )}

        {/* Trust Lines */}
        {!loading && linesData && (
          <div>
            <h3 className="mb-2 text-lg font-semibold">Trustlines</h3>
            {linesData.length === 0 ? (
              <p className="text-sm text-gray-300">
                No trustline data available.
              </p>
            ) : (
              <ul className="space-y-3">
                {Object.entries(groupedBalances).map(
                  ([currency, totalBalance]) => (
                    <li
                      key={currency}
                      className="border-b border-[#8E909D] pb-2"
                    >
                      <strong>{currency}</strong>: {totalBalance.toFixed(6)}
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>
        )}

        {/* Close Button */}
        <div className="absolute right-6 bottom-5 mt-4 flex">
          <Button variant="cancel" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
