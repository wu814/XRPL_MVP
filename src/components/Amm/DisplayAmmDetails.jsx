import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Navbar from "../Navigation/Navbar";
import ErrorMdl from "../ErrorMdl";
import CurrencyIcon from "../Currency/CurrencyIcon";
import AmmCompositionBar from "./AmmCompositionBar";
import ManageAmmBalance from "./ManageAmmBalance";
import Breadcrumbs from "../Navigation/Breadcrumbs";

class Wallet {
  constructor(classicAddress, walletType, seed) {
    this.classicAddress = classicAddress;
    this.walletType = walletType;
    this.seed = seed;
  }
}

// This class is used to parse the AMM data returned from the API
class AmmInfo {
  constructor(data) {
    this.account = data.account;
    this.trading_fee = data.trading_fee;

    // LP Token (always IOU format)
    this.lp_token = {
      currency: data.lp_token.currency,
      issuer: data.lp_token.issuer,
      value: parseFloat(data.lp_token.value),
    };

    // Asset 1 and 2 (XRP or IOU)
    this.amount = this.parseAmount(data.amount);
    this.amount2 = this.parseAmount(data.amount2);
  }

  // Converts XRP from drops or parses IOU
  parseAmount(amount) {
    if (typeof amount === "string") {
      // XRP is a string of drops
      return {
        currency: "XRP",
        issuer: null,
        value: parseFloat(amount) / 1_000_000, // Convert drops to XRP
      };
    } else {
      // IOU is an object
      return {
        currency: amount.currency,
        issuer: amount.issuer,
        value: parseFloat(amount.value),
      };
    }
  }
}

export default function DisplayAmmDetails({ ammAddress }) {
  const [ammInfo, setAmmInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [currency1, setCurrency1] = useState("");
  const [currency2, setCurrency2] = useState("");
  const [wallets, setWallets] = useState([]);

  // Pass username to the Navbar
  const [username, setUsername] = useState(null);
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "authenticated") {
      setUsername(session.user.username);
    }
  }, [session, status]);


  // Get wallet seed so we can add liquidity
  const fetchWallets = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/wallets/getWalletsByUserID");
      const result = await res.json();
      if (Array.isArray(result.data) && result.data.length > 0) {
        const walletsData = result.data.map(
          (wallet) =>
            new Wallet(wallet.classic_address, wallet.wallet_type, wallet.seed),
        );
        setWallets(walletsData);
      }
    } catch (error) {
      console.error("Error fetching wallets:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAmmInfo = async () => {
    try {
      const res = await fetch("/api/amms/getAmmInfo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset1: ammAddress }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to fetch AMM info");
      setAmmInfo(new AmmInfo(result.data));
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Retrieve cached AMM data from localStorage
    const cached = localStorage.getItem("selectedAMM");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed?.ammAddress === ammAddress) {
          setCurrency1(parsed.pair[0]);
          setCurrency2(parsed.pair[1]);
        }
      } catch (e) {
        console.error("Failed to parse cached AMM", e);
      }
    }
    fetchAmmInfo();
    fetchWallets();
  }, [ammAddress]);

  // Delete later
  useEffect(() => {
    console.log(ammInfo);
  }, [ammInfo]);

  const renderPriceInfo = () => {
    const a1 = parseFloat(ammInfo?.amount?.value);
    const a2 = parseFloat(ammInfo?.amount2?.value);
    if (isNaN(a1) || isNaN(a2) || a1 <= 0 || a2 <= 0) return null;

    const s1 = currency1 || "Asset1";
    const s2 = currency2 || "Asset2";
    const price1 = (a2 / a1).toFixed(6);
    const price2 = (a1 / a2).toFixed(6);

    return (
      <div className="mb-4">
        <h3 className="mb-1 text-lg text-white">Price Information</h3>
        <p className="text-sm">
          1 {s1} = {price1} {s2} / 1 {s2} = {price2} {s1}
        </p>
      </div>
    );
  };

  const renderTradingFee = () => (
    <div>
      <h3 className="mb-2 text-mutedText">Trading Fee</h3>
      <p className="text-lg font-semibold">
        {`${(ammInfo?.trading_fee / 1000).toFixed(2)}%`}
      </p>
    </div>
  );

  return (
    <div>
      <Navbar username={username}/>
      <div className="container mx-auto">
        <Breadcrumbs customLabel={`${currency1}/${currency2}`} />
        <div className="flex flex-row gap-2 py-6">
          <CurrencyIcon symbol={currency1} heightClass="h-8" widthClass="w-8" />
          <CurrencyIcon symbol={currency2} heightClass="h-8" widthClass="w-8" />
        </div>
        <div className="grid grid-cols-6 gap-4 py-4">
          <div className="col-span-2 rounded-xl bg-color2 p-4">
            <h3 className="text-mutedText">Pool Composition</h3>
            <AmmCompositionBar
              amount1={ammInfo?.amount}
              amount2={ammInfo?.amount2}
            />
            {renderPriceInfo()}
          </div>
          <div className="col-span-1 rounded-xl bg-color2 p-4">
            <h3 className="mb-2 text-mutedText">Pool Value</h3>
            <p className="text-lg font-semibold">$99999.99</p>
          </div>
          <div className="col-span-1 rounded-xl bg-color2 p-4">
            <h3 className="mb-2 text-mutedText">Volume (24h)</h3>
            <p className="text-lg font-semibold">$99999.99</p>
          </div>
          <div className="col-span-1 rounded-xl bg-color2 p-4">
            <h3 className="mb-2 text-mutedText">APR</h3>
            <p className="text-lg font-semibold">$99999.99</p>
          </div>
          <div className="col-span-1 rounded-xl bg-color2 p-4">
            {renderTradingFee()}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Swap/Add/Withdraw Panel */}
          <div className="col-span-1 rounded-xl bg-color2 p-4">
            <ManageAmmBalance
              ammInfo={ammInfo}
              wallets={wallets}
              onChange={fetchAmmInfo}
            />
          </div>
          {/* Volume/TVL/Fees Graph */}
          <div className="col-span-2 rounded-xl bg-color2 p-4 text-mutedText">
            Volume/TVL/Fees Chart
          </div>
        </div>
      </div>
    </div>
  );
}
