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
      payCurrency,
      getCurrency,
      payAmount,
      getAmount,
      issuerAddress,
      offerCreatorWallet,
    } = await req.json();

    if (!payCurrency || !getCurrency || !payAmount || !getAmount) {
      return NextResponse.json(
        { error: "Missing required input." },
        { status: 400 },
      );
    }

    const takerPays =
      payCurrency === "XRP"
        ? xrpToDrops(payAmount)
        : {
            currency: payCurrency,
            issuer: issuerAddress,
            value: payAmount,
          };

    const takerGets =
      getCurrency === "XRP"
        ? xrpToDrops(getAmount)
        : {
            currency: getCurrency,
            issuer: issuerAddress,
            value: getAmount,
          };

    // You should securely fetch the wallet here. Using a dummy wallet for example:
    const wallet = Wallet.fromSeed(offerCreatorWallet.seed); // replace with real wallet seed logic

    let result;
    switch (offerType) {
      case "FillOrKill":
        result = await createFillOrKillOffer(
          wallet,
          takerPays,
          takerGets,
        );
        break;
      case "ImmediateOrCancel":
        result = await createImmediateOrCancelOffer(
          wallet,
          takerPays,
          takerGets,
        );
        break;
      case "Passive":
        result = await createPassiveOffer(
          wallet,
          takerPays,
          takerGets,
        );
        break;
      case "Sell":
        result = await createSellOffer(
          wallet,
          takerPays,
          takerGets,
        );
        break;
      default:
        result = await createOffer(
          wallet,
          takerPays,
          takerGets,
        );
        break;
    }
    return NextResponse.json(
      {
        success: result.success,
        sequence: result.sequence,
        message: result.message,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
