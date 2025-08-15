import { AMMData, AMMInfo } from "@/types/xrpl/index";


export interface GetAllAMMDataAPIResponse {
  message: string;
  data: AMMData[];
}

export interface GetAMMInfoAPIRequest {
  account: string;
}

export interface GetAMMInfoAPIResponse {
  message: string;
  data: AMMInfo;
}