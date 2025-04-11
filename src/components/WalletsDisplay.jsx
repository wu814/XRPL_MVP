"use client";

import React, { useState , useEffect} from "react";
import Button from "./Button";

class Wallet {
    constructor(classic_address, wallet_name, wallet_type, xrp_balance) {
      this.classic_address = classic_address;
      this.wallet_name = wallet_name;
      this.wallet_type = wallet_type;
      this.xrp_balance = xrp_balance;
    }
  }
  

const WalletsDisplay = () => {
    const [wallets, setWallets] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchWallets = async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/wallets/selectAllWallets");
            const data = await response.json();
            const walletsData = data.data.map(wallet => new Wallet(wallet.classic_address, wallet.wallet_name, wallet.wallet_type, wallet.xrp_balance));
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
                            <Button className="absolute bottom-3 right-4" variant="submit">
                                View Details
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default WalletsDisplay;