"use client";

import React, { useState } from "react";
import Button from "./Button";
import CreateWalletPopup from "./CreateWalletPopup";


export default function CreateWalletBtn({ onWalletCreated }) {
    const [showPopup, setShowPopup] = useState(false);

    const handleWalletCreated = (newWalletData) => {
        // Forward the new wallet data to the parent via the onWalletCreated callback,
        // if you want to update your state accordingly.
        if (onWalletCreated) {
            onWalletCreated(newWalletData);
        }
    };

    return (
        <div>
            <Button
                variant="submit"
                onClick={() => setShowPopup(true)}
                className="w-full mt-4 hover:scale-none"
            >
                + Create Wallet
            </Button>

            {showPopup && (
                <CreateWalletPopup
                    onClose={() => setShowPopup(false)}
                    onWalletCreated={handleWalletCreated}
                />
            )}
        </div>
    );
}
