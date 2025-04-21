"use client";

import React, { useState, useEffect } from "react";
import Button from "../Button";
import ErrorModal from "../ErrorModal";
import SuccessModal from "../SuccessModal";
import CurrencyDropDown from "../CurrencyDropDown";

export default function CreateAdminWalletModal({
    onClose,
    onSubmit,
    loading,
    errorMessage,
    onErrorClose,
    successMessage,
    onSuccessClose,
}) {

    const[currency, setCurrency] = useState("");

    const handleSubmit = () => {
        if (!currency) return;
        onSubmit(currency);
    }


    return (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-stone-950/50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-96 space-y-4">
                <h2 className="text-center text-lg font-semibold">
                    Select Currency
                </h2>
                <CurrencyDropDown
                    value={currency}
                    onChange={setCurrency}
                />
                <div className="flex justify-end space-x-2">
                    <Button
                        variant="cancel"
                        onClick={onClose}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="submit"
                        onClick={() => handleSubmit()}
                        disabled={loading || !currency}
                    >
                        {loading ? "Creating..." : "Create Wallet"}
                    </Button>
                </div>
            </div>

            {errorMessage && (
                <ErrorModal
                    errorMessage={errorMessage}
                    onClose={onErrorClose}
                />
            )}
            {successMessage && (
                <SuccessModal
                    successMessage={successMessage}
                    onClose={onSuccessClose}
                />
            )}
        </div>
    );
}
