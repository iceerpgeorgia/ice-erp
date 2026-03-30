require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // USD rate from 2026-03-25 (nearest previous available rate)
  const usdRate = 2.7166;

  const recordIds = [53205, 53206];

  for (const id of recordIds) {
    const { data: rec } = await supabase
      .from('GE78BG0000000893486000_BOG_GEL')
      .select('id, account_currency_amount, nominal_amount, nominal_currency_uuid')
      .eq('id', id)
      .single();

    const gelAmount = parseFloat(rec.account_currency_amount);
    const correctNominal = parseFloat((gelAmount / usdRate).toFixed(2));

    console.log(`Record ${id}: GEL ${gelAmount} / ${usdRate} = USD ${correctNominal}`);

    const { error } = await supabase
      .from('GE78BG0000000893486000_BOG_GEL')
      .update({ 
        nominal_amount: correctNominal,
        nominal_exchange_rate: usdRate
      })
      .eq('id', id);

    if (error) {
      console.log(`  ERROR updating: ${error.message}`);
    } else {
      console.log(`  Updated nominal_amount to ${correctNominal}`);
    }
  }
}

main().catch(e => console.error(e));
