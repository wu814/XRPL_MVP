import { client, connectXRPLClient } from "../testnet";

/**
 * Oracle Data Controller - Fetch Price Oracle data from XRPL
 * Based on XRPL Commons documentation: https://docs.xrpl-commons.org/xrpl-basics/price-oracles
 */

interface OracleNode {
  Provider: string;
  AssetClass: string;
  PriceDataSeries?: PriceDataSeries[];
  [key: string]: any;
}

interface PriceDataSeries {
  PriceData: {
    BaseAsset: string;
    QuoteAsset: string;
    AssetPrice: string | number;
    Scale: number;
    AssetPriceDecimal?: number;
  };
  [key: string]: any;
}

interface DecodedOracle extends OracleNode {
  Provider: string;
  AssetClass: string;
  PriceDataSeries?: PriceDataSeries[];
}

interface OracleDataResult {
  success: boolean;
  oracle: DecodedOracle;
  rawOracle: OracleNode;
  ledgerIndex: string | number;
}

/**
 * Convert hex string to UTF-8 string
 * @param hex - Hex string to convert
 * @returns UTF-8 string
 */
function hexToString(hex: string): string {
  try {
    if (!hex) return "";

    // Remove 0x prefix if present
    const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;

    // Convert hex to buffer and then to string
    const buffer = Buffer.from(cleanHex, "hex");
    return buffer.toString("utf8").replace(/\0/g, ""); // Remove null terminators
  } catch (error) {
    console.error("Error converting hex to string:", error);
    return hex; // Return original hex if conversion fails
  }
}

/**
 * Retrieve a single Price Oracle using ledger_entry method
 * @param account - Oracle owner account address
 * @param oracleDocumentId - Oracle document ID
 * @param ledgerIndex - Ledger index ("validated", "current", or specific number)
 * @returns Oracle data from ledger
 */
export async function getOracleData(
  account: string,
  oracleDocumentId: number,
  ledgerIndex: string | number = "validated"
): Promise<OracleDataResult> {
  try {
    await connectXRPLClient();

    console.log(`🔍 Retrieving Price Oracle data...`);
    console.log(`   👤 Account: ${account}`);
    console.log(`   🆔 Oracle ID: ${oracleDocumentId}`);
    console.log(`   📚 Ledger: ${ledgerIndex}`);

    const ledgerEntryRequest = {
      command: "ledger_entry" as const,
      oracle: {
        account: account,
        oracle_document_id: oracleDocumentId,
      },
      ledger_index: ledgerIndex,
    };

    const ledgerEntryResponse = await client.request(ledgerEntryRequest as any);

    if (ledgerEntryResponse.result && (ledgerEntryResponse.result as any).node) {
      const oracleNode: OracleNode = (ledgerEntryResponse.result as any).node;

      // Decode hex fields for better readability
      const decodedOracle: DecodedOracle = {
        ...oracleNode,
        Provider: hexToString(oracleNode.Provider),
        AssetClass: hexToString(oracleNode.AssetClass),
        PriceDataSeries: oracleNode.PriceDataSeries?.map((series) => ({
          ...series,
          PriceData: {
            ...series.PriceData,
            // Convert AssetPrice from hex to decimal if needed
            AssetPriceDecimal: convertAssetPriceToDecimal(
              series.PriceData.AssetPrice,
              series.PriceData.Scale,
            ),
          },
        })),
      };

      return {
        success: true,
        oracle: decodedOracle,
        rawOracle: oracleNode,
        ledgerIndex: (ledgerEntryResponse.result as any).ledger_index || ledgerIndex,
      };
    } else {
      throw new Error(
        `Oracle not found: Account ${account}, ID ${oracleDocumentId}`,
      );
    }
  } catch (error) {
    console.error(`❌ Error retrieving Oracle data:`, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// Convert AssetPrice to decimal representation
function convertAssetPriceToDecimal(assetPrice: string | number, scale: number): number {
  try {
    // Handle both hex and decimal inputs
    let price: number;
    if (typeof assetPrice === "string" && assetPrice.startsWith("0x")) {
      price = parseInt(assetPrice, 16);
    } else if (typeof assetPrice === "string") {
      // If it's a hex string without 0x prefix
      price = parseInt("0x" + assetPrice, 16);
    } else {
      price = assetPrice;
    }

    const divisor = Math.pow(10, scale || 0);
    return price / divisor;
  } catch (error) {
    console.error("Error converting AssetPrice:", error);
    return typeof assetPrice === "number" ? assetPrice : 0;
  }
}
