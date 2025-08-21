import { ErrorInfo } from "@/types/xrpl/errorXRPLTypes";

export type SendCrossCurrencyResult = {
  success: boolean;
  message?: string;
  error?: ErrorInfo;
}

export type SendIOUResult = {
  success: boolean;
  message?: string;
  error?: ErrorInfo;
}

export type SendXRPResult = {
  success: boolean;
  message?: string;
  error?: ErrorInfo;
}