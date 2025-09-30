import { AccountOffer, Amount } from "xrpl";


export type CancelOfferResult =  {
  success: boolean;
  message: string;
  errorCode?: string;
}

export type CreateOfferResult =  {
  success: boolean;
  message: string;
  errorCode?: string;
}
// Create a type alias for the enhanced offer
export interface EnhancedOffer extends AccountOffer {
  dateTime?: string;
  creationHash?: string;
};

// Create a type alias for completed offers
export interface EnhancedCompletedOffer {
  sequence: number;
  takerPays: Amount;
  takerGets: Amount;
  createdAtDateTime: string;
  completedAtDateTime: string;
  status: "filled" | "cancelled";
  createHash: string | null;
  completeHash: string | null;
};
