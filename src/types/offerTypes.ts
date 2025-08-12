import { AccountOffer, Amount } from "xrpl";

export interface OfferWithTimestamp extends AccountOffer {
  timestamp?: number;
  date?: string;
  creation_hash?: string;
}

export type GetUserOffersAPIResponse = {
  success: true;
  message: string;
  data: OfferWithTimestamp[];
} | {
  success: false;
  error: string;
};

export type CompletedOffer = {
  sequence: number;
  taker_pays: Amount;
  taker_gets: Amount;
  createdAt: Date | null;
  completedAt: Date | null;
  formattedCreatedDate: string;
  formattedCompletedDate: string;
  status: "filled" | "cancelled";
  createHash: string | null;
  completeHash: string | null;
  isEstimated?: boolean;
};

export type GetCompletedOffersAPIResponse = {
  success: true;
  message: string;
  data: CompletedOffer[];
} | {
  success: false;
  error: string;
};