import { AccountOffer, Amount } from "xrpl";

// Create a type alias for the enhanced offer
export interface EnhancedOffer extends AccountOffer {
  dateTime?: string;
  creation_hash?: string;
};

// Create a type alias for completed offers
export interface EnhancedCompletedOffer {
  sequence: number;
  taker_pays: Amount;
  taker_gets: Amount;
  createdAtDateTime: string;
  completedAtDateTime: string;
  status: "filled" | "cancelled";
  createHash: string | null;
  completeHash: string | null;
};
