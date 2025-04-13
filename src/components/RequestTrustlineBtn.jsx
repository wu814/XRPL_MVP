"use client";

import React, { useState } from "react";
import Button from "./Button";
import ErrorPopup from "./ErrorPopup";
import { client, connectXrplClient } from "@/utils/xrpl/testnet";
import * as xrpl from "xrpl";

export default function RequestTrustlineBtn({ requester_wallet, issuer_wallets }) {
    const MAX_TRUST_LIMIT = "1000000000"; // 1 billion of the currency
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleRequestTrustline = async () => {
        setError(null);
        let currency = "";
        if (requester_wallet.wallet_type === "Operational") {
            currency = requester_wallet.wallet_name;
        } else if (requester_wallet.wallet_type === "Standby") {
            // For a Standby wallet, prompt the user to input the currency.
            const userInput = window.prompt("Enter the currency for the trustline:");
            if (!userInput || userInput.trim() === "") {
                setError("Currency is required for Standby wallet.");
                return;
            }
            currency = userInput.trim().toUpperCase();
        }

        setLoading(true);
        try {
            await connectXrplClient();
            // Build the TrustSet transaction with the determined currency.
            const trustSetTx = {
                TransactionType: "TrustSet",
                Account: requester_wallet.classic_address,
                LimitAmount: {
                    currency: currency,
                    issuer: issuer_wallets[0].classic_address,
                    value: MAX_TRUST_LIMIT,
                },
                Flags: 131072, // tfSetNoRipple
            };
            const wallet = xrpl.Wallet.fromSeed(requester_wallet.seed);
            const preparedTx = await client.autofill(trustSetTx);
            const signedTx = wallet.sign(preparedTx);
            const response = await client.submitAndWait(signedTx.tx_blob);
            if (response.result.meta.TransactionResult === "tesSUCCESS") {
                console.log(`✅ Trustline request submitted from ${wallet.classicAddress} to ${issuer_wallets[0].classic_address} for ${currency}.`);
                alert('Trustline created successfully!');
            } else {
                throw new Error(`Trustline request failed: ${response.result.meta.TransactionResult}`);
            }

            // Store the trustline in the database
            const trustlineData = {
                requester_classic_address: requester_wallet.classic_address,
                issuer_classic_address: issuer_wallets[0].classic_address,
                currency: currency,
                limit_amount: MAX_TRUST_LIMIT,
                is_authorized: false,
                is_activated: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            const res = await fetch("/api/trustlines/createTrustline", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(trustlineData),
            });

            const result = await res.json();
            if (!res.ok) {
                throw new Error(result.error || "Failed to add wallet");
            }

        } catch (error) {
            setError("Trustline request failed -- " + error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <Button
                variant="submit"
                onClick={handleRequestTrustline}
                disabled={loading}
            >
                {loading ? "Requesting..." : "Request Trustline"}
            </Button>
            {error && <ErrorPopup errorMessage={error} onClose={() => setError(null)} />}

        </div>
    );
}
