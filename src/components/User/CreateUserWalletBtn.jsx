"use client";

import React, { useState } from "react";
import Button from "../Button";
import CreateUserWalletModal from "./CreateUserWalletModal";


export default function CreateAdminWalletBtn({ onWalletCreated }) {
    const [showModal, setShowModal] = useState(false);

    const handleWalletCreated = (currency) => {
        // Forward the new wallet data to the parent via the onWalletCreated callback,
        // if you want to update your state accordingly.
        if (onWalletCreated) {
            onWalletCreated(currency);
        }
    };

    return (
        <div>
            <Button
                variant="submit"
                onClick={() => setShowModal(true)}
                className="w-full mt-4 hover:scale-none"
            >
                + Create Wallet
            </Button>

            {showModal && (
                <CreateUserWalletModal
                    onClose={() => setShowModal(false)}
                    onWalletCreated={handleWalletCreated}
                />
            )}
        </div>
    );
}
