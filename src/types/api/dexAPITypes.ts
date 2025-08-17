import { EnhancedOffer, EnhancedCompletedOffer } from "@/types/xrpl/dexXRPLTypes";
import { YONAWallet } from "@/types/appTypes";

export interface GetUserOffersAPIRequest {
  sourceWallet: YONAWallet;
}

export interface GetUserOffersAPIResponse {
  message: string;
  data: EnhancedOffer[];
}

export interface GetCompletedOffersAPIRequest {
  sourceWallet: YONAWallet;
}

export interface GetCompletedOffersAPIResponse {
  message: string;
  data: EnhancedCompletedOffer[];
}
