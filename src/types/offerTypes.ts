import { AccountOffer } from "xrpl";

export interface OfferWithTimestamp extends AccountOffer {
  timestamp?: number;
  date?: string;
  creation_hash?: string;
}

export type GetUserOffersResponse = {
  success: true;
  message: string;
  data: OfferWithTimestamp[];
} | {
  success: false;
  error: string;
};