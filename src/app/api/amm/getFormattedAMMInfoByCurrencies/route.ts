import { NextRequest, NextResponse } from 'next/server';
import { getFormattedAMMInfoByCurrencies } from '@/utils/xrpl/amm/ammUtils';
import { GetFormattedAMMInfoByCurrenciesAPIRequest, GetFormattedAMMInfoByCurrenciesAPIResponse } from '@/types/api/ammAPITypes';
import { APIErrorResponse } from '@/types/api/errorAPITypes';

export async function POST(request: NextRequest): Promise<NextResponse<GetFormattedAMMInfoByCurrenciesAPIResponse | APIErrorResponse>> {
  try {
    const { sellCurrency, buyCurrency }: GetFormattedAMMInfoByCurrenciesAPIRequest = await request.json();
        
    if (!sellCurrency || !buyCurrency) {
      return NextResponse.json<APIErrorResponse>({
        message: 'Missing sellCurrency or buyCurrency'
      }, { status: 400 });
    }

    const ammData = await getFormattedAMMInfoByCurrencies(sellCurrency, buyCurrency);
    
    if (!ammData) {
      return NextResponse.json<APIErrorResponse>({
        message: `No AMM pool found for ${sellCurrency}/${buyCurrency}`
      }, { status: 404 });
    }
    
    return NextResponse.json<GetFormattedAMMInfoByCurrenciesAPIResponse>({
      message: `${sellCurrency}/${buyCurrency} AMM pool found`,
      data: ammData
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json<APIErrorResponse>({
      message: errorMessage
    }, { status: 500 });
  }
}