"use client";

import React, { useState, useEffect } from "react";
import Button from "./Button";
import CreateWalletBtn from "./CreateWalletBtn";
import DeleteWalletBtn from "./DeleteWalletBtn";

class Wallet {
    constructor(classic_address, wallet_type, wallet_name, xrp_balance) {
        this.classic_address = classic_address;
        this.wallet_type = wallet_type;
        this.wallet_name = wallet_name;
        this.xrp_balance = xrp_balance;
    }
}


const WalletsDisplay = () => {
    const [wallets, setWallets] = useState([]);
    const [loading, setLoading] = useState(false);

    // Define a sort order for wallet types. Issuer always on top, then Standby, then Operational.
    const typeOrder = {
        "Issuer": 0,
        "Standby": 1,
        "Operational": 2,
    };

    const fetchWallets = async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/wallets/selectAllWallets");
            const data = await response.json();
            const walletsData = data.data
                .map(wallet => new Wallet(wallet.classic_address, wallet.wallet_type, wallet.wallet_name, wallet.xrp_balance))
                .sort((a, b) => typeOrder[a.wallet_type] - typeOrder[b.wallet_type]);
            setWallets(walletsData);
        } catch (error) {
            console.error("Error fetching wallets:", error);
        } finally {
            setLoading(false);
        }

    }

    useEffect(() => {
        fetchWallets();
    }, []);

    // Instead of re-fetching wallets, update the state with the new wallet.
    const handleWalletCreated = (newWalletData) => {
        setWallets((prevWallets) => [...prevWallets, newWalletData].sort((a, b) => typeOrder[a.wallet_type] - typeOrder[b.wallet_type]));
    };

    // Instead of re-fetching wallets, filter out the deleted wallet.
    const handleDeleteWallet = (deletedClassicAddress) => {
        setWallets((prevWallets) =>
            prevWallets.filter(
                (wallet) => wallet.classic_address !== deletedClassicAddress
            )
        );
    };


    return (
        <div className="container mx-auto mr-4">
            {loading ? (
                <p className="text-center text-gray-500">Loading...</p>
            ) : wallets.length === 0 ? (
                <p className="text-center text-gray-500">No wallets found.</p>
            ) : (
                <div className="flex flex-col space-y-4">
                    {wallets.map((wallet) => (
                        <div key={wallet.classic_address} className="relative bg-white p-4 rounded-lg shadow">
                            <h3 className="text-xl font-bold">{wallet.classic_address}</h3>
                            <p>Type: {wallet.wallet_type}</p>
                            <p>Name: {wallet.wallet_name}</p>
                            <p>XRP Balance: {wallet.xrp_balance}</p>
                            <DeleteWalletBtn
                                classic_address={wallet.classic_address}
                                onWalletDeleted={handleDeleteWallet}

                            />
                            <div className="flex-row absolute bottom-3 right-4 space-x-2">
                                {/* Conditionally render trustline buttons */}
                                {wallet.wallet_type === "Issuer" && (
                                    <>
                                        <Button
                                            variant="primary"
                                        // onClick={() =>
                                        //     handleCreateTrustline(wallet.classic_address)
                                        // }
                                        >
                                            Set Flags
                                        </Button>

                                        <Button
                                            variant="submit"
                                        // onClick={() =>
                                        //     handleApproveTrustline(wallet.classic_address)
                                        // }
                                        >
                                            Approve Trustline
                                        </Button>
                                    </>

                                )}
                                {(wallet.wallet_type === "Standby" ||
                                    wallet.wallet_type === "Operational") && (
                                        <Button
                                            variant="submit"
                                        // onClick={() =>
                                        //     handleRequestTrustline(wallet.classic_address)
                                        // }
                                        >
                                            Request Trustline
                                        </Button>
                                    )}
                                <Button className="" variant="submit">
                                    View Details
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <CreateWalletBtn onWalletCreated={handleWalletCreated} />
        </div>
    );
};

export default WalletsDisplay;