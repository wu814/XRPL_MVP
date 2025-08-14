import { AccountOffer, Amount } from "xrpl";

// Create a type alias for the enhanced offer
export type EnhancedOffer = AccountOffer & {
  dateTime?: string;
  creation_hash?: string;
};

// Create a type alias for completed offers
export type EnhancedCompletedOffer = {
  sequence: number;
  taker_pays: Amount;
  taker_gets: Amount;
  createdAtDateTime: string;
  completedAtDateTime: string;
  status: "filled" | "cancelled";
  createHash: string | null;
  completeHash: string | null;
};

export type GetUserOffersResult = {
  success: boolean;
  message: string;
  data: EnhancedOffer[];
  error?: string;
}

export type GetCompletedOffersResult = {
  success: boolean;
  message: string;
  data: EnhancedCompletedOffer[];
  error?: string;
}
