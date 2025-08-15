import { NextRequest, NextResponse } from 'next/server';
import { getAMMInfoByCurrencies } from '@/utils/xrpl/amm/ammUtils';

interface GetAMMInfoByCurrenciesRequest {
  sellCurrency: string;
  buyCurrency: string;
}

interface AMMData {
  amm_account: string;
  amount: {
    currency: string;
    value: string;
  };
  amount2: {
    currency: string;
    value: string;
  };
}

interface GetAMMInfoByCurrenciesResponse {
  success: boolean;
  data?: AMMData;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<GetAMMInfoByCurrenciesResponse>> {
  try {
    const { sellCurrency, buyCurrency }: GetAMMInfoByCurrenciesRequest = await request.json();
    
    console.log(`🔍 Getting AMM info for ${sellCurrency}/${buyCurrency}`);
    
    if (!sellCurrency || !buyCurrency) {
      return NextResponse.json({
        success: false,
        error: 'Both sellCurrency and buyCurrency are required'
      }, { status: 400 });
    }

    if (sellCurrency === buyCurrency) {
      return NextResponse.json({
        success: false,
        error: 'Cannot swap same currency'
      }, { status: 400 });
    }
    
    const ammData = await getAMMInfoByCurrencies(sellCurrency, buyCurrency);
    
    if (!ammData) {
      return NextResponse.json({
        success: false,
        error: `No AMM pool found for ${sellCurrency}/${buyCurrency}`
      }, { status: 404 });
    }
    
    console.log(`✅ Found AMM pool: ${ammData.amm_account}`);
    console.log(`📊 Pool balances: ${ammData.amount.currency}=${ammData.amount.value}, ${ammData.amount2.currency}=${ammData.amount2.value}`);
    
    return NextResponse.json({
      success: true,
      data: ammData
    });
    
  } catch (error) {
    console.error('❌ Error getting AMM info by currencies:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}
