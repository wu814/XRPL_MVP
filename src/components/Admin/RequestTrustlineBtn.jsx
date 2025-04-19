"use client";

import React, { useState } from "react";
import Button from "../Button";
import ErrorModal from "../ErrorModal";
import SuccessModal from "../SuccessModal";
import CurrencyDropDown from "../CurrencyDropDown";
import { requestTrustline } from "@/utils/xrpl/requestTrustline";

export default function RequestTrustlineBtn({requester_wallet, issuer_wallets,}) {
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    // for Standby wallets
    const [currency, setCurrency] = useState("");
    const [showCurrencyModal, setShowCurrencyModal] = useState(false);

    // Centralized request routine
    const doRequest = async selCurrency => {
        setLoading(true);
        setErrorMessage(null);
        try {
            const data = await requestTrustline(
                requester_wallet,
                issuer_wallets,
                selCurrency
            );
            setSuccessMessage(`Trustline request submitted from ${requester_wallet.classic_address} to ${issuer_wallets[0].classic_address} for ${selCurrency}.`);
            const resp = await fetch("/api/trustlines/createTrustline", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            const json = await resp.json();
            if (!resp.ok) throw new Error(json.error || "Request failed");
        } catch (err) {
            setErrorMessage(err.message);
        } finally {
            setLoading(false);
            setShowCurrencyModal(false);
        }
    };

    // Entry point when the user clicks the main button
    const handleClick = () => {
        if (requester_wallet.wallet_type === "Operational") {
            // currency is baked into the wallet
            doRequest(requester_wallet.wallet_name);
        } else if (requester_wallet.wallet_type === "Standby") {
            // pop up the dropdown
            setCurrency("");
            setShowCurrencyModal(true);
        } else {
            setErrorMessage("Cannot request a trustline for this wallet type.");
        }
    };

    return (
        <>
            <Button
                variant="submit"
                onClick={handleClick}
                disabled={loading}
            >
                {loading ? "Requesting…" : "Request Trustline"}
            </Button>

            {showCurrencyModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50">
                    <div className="bg-white p-6 rounded-lg shadow-lg w-96 space-y-4">
                        <h2 className="text-center text-lg font-semibold">
                            Select Currency
                        </h2>
                        <CurrencyDropDown
                            value={currency}
                            onChange={setCurrency}
                            options = {["BTC", "ETH", "USD"]}  // Make sure it doesn't include XRP (XRP doesn't need trustline)
                        />
                        <div className="flex justify-end space-x-2">
                            <Button
                                variant="cancel"
                                onClick={() => setShowCurrencyModal(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="submit"
                                onClick={() => doRequest(currency)}
                                disabled={loading || !currency}
                            >
                                {loading ? "Requesting…" : "Request Trustline"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {errorMessage && (
                <ErrorModal
                    errorMessage={errorMessage}
                    onClose={() => setErrorMessage(null)}
                />
            )}

            {successMessage && (
                <SuccessModal
                    successMessage={successMessage}
                    onClose={() => {
                        setSuccessMessage(null);
                        setShowCurrencyModal(false);
                    }}
                />
            )}
        </>
    );
}
