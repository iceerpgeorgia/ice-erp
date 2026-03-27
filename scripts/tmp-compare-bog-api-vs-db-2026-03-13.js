const BASE='https://fojbzghphznbslqwurrm.supabase.co';
const KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvamJ6Z2hwaHpuYnNscXd1cnJtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTU5NTYxMywiZXhwIjoyMDc3MTcxNjEzfQ.LItw6fL0Go4IRllC7D1bp_xjFFrNf31chAk5rzr4KM0';
const DATE='2026-03-13';
const insiderDefault='2a55debb-261b-4ce9-bae4-296ddea037ab';

const headers={apikey:KEY,Authorization:`Bearer ${KEY}`};

function schemeByCurrency(c){
  if(c==='USD') return 'BOG_USD';
  if(c==='EUR') return 'BOG_EUR';
  if(c==='AED') return 'BOG_AED';
  if(c==='GBP') return 'BOG_GBP';
  if(c==='KZT') return 'BOG_KZT';
  if(c==='CNY') return 'BOG_CNY';
  if(c==='TRY') return 'BOG_TRY';
  return 'BOG_GEL';
}

async function j(url){
  const r=await fetch(url,{headers});
  const txt=await r.text();
  let data=null; try{data=JSON.parse(txt)}catch{}
  if(!r.ok) throw new Error(`${r.status} ${txt}`);
  return data;
}

async function dbCount(table){
  const q=`${encodeURIComponent(table)}?select=uuid&transaction_date=eq.${DATE}`;
  const r=await fetch(`${BASE}/rest/v1/${q}`,{headers:{...headers,Prefer:'count=exact',Range:'0-0'}});
  const cr=r.headers.get('content-range')||'';
  const m=cr.match(/\/(\d+)$/);
  const count=m?Number(m[1]):0;
  return {status:r.status,count,contentRange:cr};
}

async function apiCount(port,a,ccy){
  const path=`/statement/${a.account_number}/${ccy}/${DATE}/${DATE}`;
  const u=new URL(`http://localhost:${port}/api/integrations/bog/statements`);
  u.searchParams.set('import','0');
  u.searchParams.set('accountUuid',a.uuid);
  u.searchParams.set('accountNoWithCurrency',`${a.account_number}${ccy}`);
  u.searchParams.set('insiderUuid',a.insider_uuid||insiderDefault);
  u.searchParams.set('currency',ccy);
  u.searchParams.set('path',path);
  const r=await fetch(u);
  const t=await r.text();
  let b=null; try{b=JSON.parse(t)}catch{}
  return {status:r.status, ok:b?.ok===true, detailsCount:b?.detailsCount ?? 0, error:b?.error || null, correlationId:b?.correlationId || null};
}

(async()=>{
  const banks=await j(`${BASE}/rest/v1/banks?select=uuid,bank_name&bank_name=eq.BOG&limit=1`);
  const bankUuid=banks[0].uuid;
  const accounts=await j(`${BASE}/rest/v1/bank_accounts?select=uuid,account_number,currency_uuid,insider_uuid&bank_uuid=eq.${bankUuid}`);
  const currencies=await j(`${BASE}/rest/v1/currencies?select=uuid,code`);
  const cMap=new Map(currencies.map(c=>[c.uuid,String(c.code||'').toUpperCase()]));

  let port=3001;
  try{ const r=await fetch(`http://localhost:${port}/api/integrations/bog/test`); if(![200,500,502].includes(r.status)) throw new Error('bad'); }
  catch{ port=3002; }

  const rows=[];
  for(const a of accounts){
    const acc=String(a.account_number||'').trim().toUpperCase();
    const ccy=cMap.get(a.currency_uuid)||'';
    const scheme=schemeByCurrency(ccy);
    const table=`${acc}_${scheme}`;
    const api=await apiCount(port,{...a,account_number:acc},ccy);
    const db=await dbCount(table);
    rows.push({accountUuid:a.uuid,accountNumber:acc,currency:ccy,table,apiStatus:api.status,apiOk:api.ok,apiCount:api.detailsCount,dbStatus:db.status,dbCount:db.count,gap:api.detailsCount-db.count,apiError:api.error});
  }

  const totals={
    date:DATE,
    apiTotal: rows.reduce((s,r)=>s+r.apiCount,0),
    dbTotal: rows.reduce((s,r)=>s+r.dbCount,0),
    totalGap: rows.reduce((s,r)=>s+r.gap,0),
    rows: rows.length,
  };

  console.log(JSON.stringify({port,totals,rows},null,2));
})();
