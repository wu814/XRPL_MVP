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
      <div className="relative w-11/12 max-w-3xl rounded-lg bg-[#3F4359] p-6 text-white shadow-lg">
        <h2 className="text-center mb-4 text-xl font-bold">Wallet Details</h2>

        {/* Loading */}
        {loading && <p className="text-center text-gray-300">Loading...</p>}

        {/* Account Info */}
        {!loading && infoData && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Account Info</h3>
            <ul className="space-y-1 text-sm">
              <li><strong>Address:</strong> {infoData.address}</li>
              <li><strong>Sequence:</strong> {infoData.sequence}</li>
              <li><strong>Balance:</strong> {infoData.balance} XRP</li>
              <li><strong>Owner Count:</strong> {infoData.ownerCount}</li>
              <li><strong>Enabled Flags:</strong> {infoData.enabledFlags}</li>
            </ul>
          </div>
        )}

        {/* Trust Lines */}
        {!loading && linesData && (
          <div>
            <h3 className="text-lg font-semibold mb-2">Trustlines</h3>
            {linesData.length === 0 ? (
              <p className="text-sm text-gray-300">No trustline data available.</p>
            ) : (
              <ul className="space-y-2 max-h-60 overflow-y-auto text-sm">
                {linesData.map((line, idx) => (
                  <li key={idx} className="border-b border-[#8E909D] pb-2">
                    <div><strong>Currency:</strong> {line.currency}</div>
                    <div><strong>Balance:</strong> {line.balance}</div>
                    <div><strong>Issuer:</strong> {line.account}</div>
                    <div><strong>Limit:</strong> {line.limit}</div>
                    <div><strong>Limit Peer:</strong> {line.limit_peer}</div>
                  </li>
                ))}
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
