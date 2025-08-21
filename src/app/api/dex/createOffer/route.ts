import { NextRequest, NextResponse } from "next/server";
import createOffer from "@/utils/xrpl/dex/createOffer";
import createFillOrKillOffer from "@/utils/xrpl/dex/createFillOrKillOffer";
import createImmediateOrCancelOffer from "@/utils/xrpl/dex/createImmediateOrCancelOffer";
import createPassiveOffer from "@/utils/xrpl/dex/createPassiveOffer";
import createSellOffer from "@/utils/xrpl/dex/createSellOffer";
import { Wallet, xrpToDrops } from "xrpl";
import { createSupabaseAnonClient } from "@/utils/supabase/server";

interface CreateOfferRequest {
  offerType: "FillOrKill" | "ImmediateOrCancel" | "Passive" | "Sell" | "Standard";
  orderType: "buy" | "sell";
  baseCurrency: string;
  quoteCurrency: string;
  limitPrice: number;
  quantity: number;
  issuerAddress: string;
  offerCreatorWallet: {
    classicAddress: string;
  };
}

export async function POST(req: NextRequest) {
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
    }: CreateOfferRequest = await req.json();

    // Validate required fields
    if (!offerType) {
      return NextResponse.json(
        { error: "Missing offer type" },
        { status: 400 },
      );
    }

    if (!orderType) {
      return NextResponse.json(
        { error: "Missing order type" },
        { status: 400 },
      );
    }

    if (!baseCurrency) {
      return NextResponse.json(
        { error: "Missing base currency" },
        { status: 400 },
      );
    }

    if (!quoteCurrency) {
      return NextResponse.json(
        { error: "Missing quote currency" },
        { status: 400 },
      );
    }

    if (!limitPrice) {
      return NextResponse.json(
        { error: "Missing limit price" },
        { status: 400 },
      );
    }

    if (!quantity) {
      return NextResponse.json(
        { error: "Missing quantity" },
        { status: 400 },
      );
    }

    if (!issuerAddress) {
      return NextResponse.json(
        { error: "Missing issuer address" },
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

    // Validate numeric values
    if (
      isNaN(limitPrice) ||
      isNaN(quantity) ||
      limitPrice <= 0 ||
      quantity <= 0
    ) {
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
      takerPays =
        baseCurrency === "XRP"
          ? xrpToDrops(quantity)
          : {
              currency: baseCurrency,
              issuer: issuerAddress,
              value: quantity.toString(),
            };

      takerGets =
        quoteCurrency === "XRP"
          ? xrpToDrops(totalValue.toString())
          : {
              currency: quoteCurrency,
              issuer: issuerAddress,
              value: totalValue.toFixed(6),
            };
    } else if (orderType === "sell") {
      // Selling base currency for quote currency
      // Taker pays: quote currency (what we want to receive)
      // Taker gets: base currency (what we're selling)
      takerPays =
        quoteCurrency === "XRP"
          ? xrpToDrops(totalValue.toString())
          : {
              currency: quoteCurrency,
              issuer: issuerAddress,
              value: totalValue.toFixed(6),
            };

      takerGets =
        baseCurrency === "XRP"
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

    // Get seed from Supabase using classicAddress
    const supabase = await createSupabaseAnonClient();
    const { data: walletData, error: walletError } = await supabase
      .from("wallets")
      .select("seed")
      .eq("classic_address", offerCreatorWallet.classicAddress)
      .single();

    if (walletError || !walletData) {
      return NextResponse.json(
        { error: "Wallet not found for the provided classicAddress" },
        { status: 404 },
      );
    }

    // Create wallet instance
    const wallet = Wallet.fromSeed(walletData.seed);

    // Create offer based on type
    let result;
    switch (offerType) {
      case "FillOrKill":
        result = await createFillOrKillOffer(wallet, takerPays, takerGets);
        break;
      case "ImmediateOrCancel":
        result = await createImmediateOrCancelOffer(
          wallet,
          takerPays,
          takerGets,
        );
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
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 },
    );
  }
}
