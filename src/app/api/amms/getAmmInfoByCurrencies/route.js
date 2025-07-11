import { NextResponse } from 'next/server';
import { getAmmInfoByCurrencies } from '@/utils/xrpl/amm/ammUtils';

export async function POST(request) {
  try {
    const { sellCurrency, buyCurrency } = await request.json();
    
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
    
    const ammData = await getAmmInfoByCurrencies(sellCurrency, buyCurrency);
    
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
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 