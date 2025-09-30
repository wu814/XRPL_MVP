import { NextRequest, NextResponse } from 'next/server';
import { getFormattedAMMInfoByCurrencies } from '@/utils/xrpl/amm/ammUtils';
import { APIResponse, GetFormattedAMMInfoByCurrenciesAPIRequest } from '@/types/apiTypes';
import { FormattedAMMInfo } from '@/types/xrpl/ammXRPLTypes';

export async function POST(request: NextRequest): Promise<NextResponse<APIResponse<FormattedAMMInfo>>> {
  try {
    const { sellCurrency, buyCurrency }: GetFormattedAMMInfoByCurrenciesAPIRequest = await request.json();
        
    if (!sellCurrency || !buyCurrency) {
      return NextResponse.json<APIResponse<FormattedAMMInfo>>({
        success: false,
        message: 'Missing sellCurrency or buyCurrency'
      }, { status: 400 });
    }

    const ammData = await getFormattedAMMInfoByCurrencies(sellCurrency, buyCurrency);
    
    if (!ammData) {
      return NextResponse.json<APIResponse<FormattedAMMInfo>>({
        success: false,
        message: `No AMM pool found for ${sellCurrency}/${buyCurrency}`
      }, { status: 404 });
    }
    
    return NextResponse.json<APIResponse<FormattedAMMInfo>>({
      success: true,
      message: `${sellCurrency}/${buyCurrency} AMM pool found`,
      data: ammData
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json<APIResponse<FormattedAMMInfo>>({
      success: false,
      message: errorMessage
    }, { status: 500 });
  }
}