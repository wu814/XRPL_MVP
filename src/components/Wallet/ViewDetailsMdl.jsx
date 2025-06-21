"use client";

import React from "react";
import Button from "../Button";

export default function ViewDetailsMdl({
  infoData,
  linesData,
  loading,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/10">
      <div className="relative h-5/6 w-11/12 max-w-3xl rounded-lg bg-color4 p-6">
        <h2 className="mb-4 text-2xl text-center text-primary font-bold">Wallet Details</h2>

        {/* Loading */}
        {loading && <p className="text-center text-mutedText">Loading...</p>}

        {/* Account Info */}
        {!loading && infoData && (
          <div className="mb-6">
            <h3 className="mb-2 text-lg font-semibold text-primary">Account Info</h3>
            <ul className="space-y-1 text-sm border-b border-border pb-2">
              <li>
                <strong>Address:</strong> {infoData.address}
              </li>
              <li>
                <strong>Sequence:</strong> {infoData.sequence}
              </li>
              <li>
                <strong>Balance:</strong> {infoData.balance.toFixed(6)} XRP
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
            <h3 className="mb-2 text-lg font-semibold text-primary">Trustlines</h3>
            {linesData.length === 0 ? (
              <p className="text-sm text-mutedText">
                No trustline data available.
              </p>
            ) : (
              <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
                {linesData.map((line, idx) => (
                  <li key={idx} className="border-b border-border pb-2">
                    <div>
                      <strong>Currency:</strong> {line.currency}
                    </div>
                    <div>
                      <strong>Balance:</strong> {line.balance}
                    </div>
                    <div>
                      <strong>Issuer:</strong> {line.account}
                    </div>
                    <div>
                      <strong>Limit:</strong> {line.limit}
                    </div>
                    <div>
                      <strong>Limit Peer:</strong> {line.limit_peer}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Close Button */}
        <div className="absolute bottom-5 right-6 mt-4 flex">
          <Button variant="cancel" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
