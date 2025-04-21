"use client";

import React, { useState, useEffect } from "react";
import Button from "../Button";
import CreateUserWalletBtn from "./CreateUserWalletBtn";
import DeleteUserWalletBtn from "./DeleteUserWalletBtn";

class UserWallet {
    constructor(id, tag, currency, balance) {
        this.id = id;
        this.tag = tag;
        this.currency = currency;
        this.balance = balance;
    }
}


const UserWalletsDisplay = () => {
    const [wallets, setWallets] = useState([]);
    const [loading, setLoading] = useState(false);


    const fetchWallets = async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/tags/getAllTagsByUserID");
            const data = await response.json();
            const walletsData = data.data
                .map(wallet => new UserWallet(wallet.id, wallet.tag, wallet.currency, wallet.balance))
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


    // Instead of re-fetching wallets, update the state with the new wallet, and update the issuer wallets.
    const handleWalletCreated = (newWalletData) => {
        setWallets((prevWallets) => {
            const updatedWallets = [...prevWallets, newWalletData];
            return updatedWallets;
        });
    };

    // Instead of re-fetching wallets, filter out the deleted wallet, and update the issuer wallets.
    const handleDeleteWallet = (deletedWalletCurrency) => {
        setWallets((prevWallets) => {
            const updatedWallets = prevWallets.filter(
                (wallet) => wallet.currency !== deletedWalletCurrency
            );
            return updatedWallets;
        });
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
                        <div key={wallet.id} className="relative bg-white p-4 rounded-lg shadow">
                            <h3 className="text-xl font-bold">{wallet.currency}</h3>
                            <h3 className="text-4xl font-bold"> $ {wallet.balance}</h3>
                            <p className="text-gray-600">Tag: {wallet.tag}</p>
                            <DeleteUserWalletBtn
                                classic_address={wallet.classic_address}
                                onWalletDeleted={handleDeleteWallet}
                            />

                        </div>
                    ))}
                </div>
            )}
            <CreateUserWalletBtn onWalletCreated={handleWalletCreated} />
        </div>
    );
};

export default UserWalletsDisplay;