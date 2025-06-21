// /api/offers/createOffer/route.js

import { NextResponse } from "next/server";
import createOffer from "@/utils/xrpl/offer/createOffer";
import createFillOrKillOffer from "@/utils/xrpl/offer/createFillOrKillOffer";
import createImmediateOrCancelOffer from "@/utils/xrpl/offer/createImmediateOrCancelOffer";
import createPassiveOffer from "@/utils/xrpl/offer/createPassiveOffer";
import createSellOffer from "@/utils/xrpl/offer/createSellOffer";
import { Wallet, xrpToDrops } from "xrpl";

export async function POST(req) {
  try {
    const {
      offerType,
      orderType,
      baseCurrency,
      quoteCurrency,
      limitPrice,
      quantity,
      issuerAddress,
      offerCreatorWallet,
    } = await req.json();

    // Validate required fields
    if (!orderType || !baseCurrency || !quoteCurrency || !limitPrice || !quantity || !issuerAddress) {
      return NextResponse.json(
        { error: "Missing required input fields." },
        { status: 400 },
      );
    }

    // Validate numeric values
    if (isNaN(limitPrice) || isNaN(quantity) || limitPrice <= 0 || quantity <= 0) {
      return NextResponse.json(
        { error: "Limit price and quantity must be positive numbers." },
        { status: 400 },
      );
    }

    // Calculate total value
    const totalValue = limitPrice * quantity;

    // Construct takerPays and takerGets based on order type
    let takerPays, takerGets;

    if (orderType === "buy") {
      // Buying base currency with quote currency
      // Taker pays: base currency (what we want to buy)
      // Taker gets: quote currency (what we're paying with)
      takerPays = baseCurrency === "XRP" 
        ? xrpToDrops(quantity)
        : {
            currency: baseCurrency,
            issuer: issuerAddress,
            value: quantity.toString(),
          };

      takerGets = quoteCurrency === "XRP"
        ? xrpToDrops(totalValue)
        : {
            currency: quoteCurrency,
            issuer: issuerAddress,
            value: totalValue.toString(),
          };
    } else if (orderType === "sell") {
      // Selling base currency for quote currency
      // Taker pays: quote currency (what we want to receive)
      // Taker gets: base currency (what we're selling)
      takerPays = quoteCurrency === "XRP"
        ? xrpToDrops(totalValue)
        : {
            currency: quoteCurrency,
            issuer: issuerAddress,
            value: totalValue.toString(),
          };

      takerGets = baseCurrency === "XRP"
        ? xrpToDrops(quantity)
        : {
            currency: baseCurrency,
            issuer: issuerAddress,
            value: quantity.toString(),
          };
    } else {
      return NextResponse.json(
        { error: "Invalid order type. Must be 'buy' or 'sell'." },
        { status: 400 },
      );
    }

    // Validate wallet exists
    if (!offerCreatorWallet) {
      return NextResponse.json(
        { error: "No valid wallet found for creating offer." },
        { status: 400 },
      );
    }

    // Create wallet instance
    const wallet = Wallet.fromSeed(offerCreatorWallet.seed);

    // Create offer based on type
    let result;
    switch (offerType) {
      case "FillOrKill":
        result = await createFillOrKillOffer(wallet, takerPays, takerGets);
        break;
      case "ImmediateOrCancel":
        result = await createImmediateOrCancelOffer(wallet, takerPays, takerGets);
        break;
      case "Passive":
        result = await createPassiveOffer(wallet, takerPays, takerGets);
        break;
      case "Sell":
        result = await createSellOffer(wallet, takerPays, takerGets);
        break;
      default:
        result = await createOffer(wallet, takerPays, takerGets);
        break;
    }

    return NextResponse.json(
      {
        success: result.success,
        sequence: result.sequence,
        message: result.message,
        orderDetails: {
          orderType,
          baseCurrency,
          quoteCurrency,
          limitPrice,
          quantity,
          totalValue,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error creating offer:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" }, 
      { status: 500 }
    );
  }
}
