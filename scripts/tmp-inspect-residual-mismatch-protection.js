const BASE='https://fojbzghphznbslqwurrm.supabase.co';
const KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvamJ6Z2hwaHpuYnNscXd1cnJtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTU5NTYxMywiZXhwIjoyMDc3MTcxNjEzfQ.LItw6fL0Go4IRllC7D1bp_xjFFrNf31chAk5rzr4KM0';
const checks=[
  {table:'GE78BG0000000893486000_BOG_GEL',date:'2026-01-09'},
  {table:'GE78BG0000000893486000_BOG_GEL',date:'2026-01-13'},
  {table:'GE78BG0000000893486000_BOG_GEL',date:'2026-01-15'},
  {table:'GE78BG0000000893486000_BOG_USD',date:'2026-01-21'},
];

async function getRows(table,date){
  const q=`${encodeURIComponent(table)}?select=uuid,dockey,entriesid,transaction_date,parsing_lock,conversion_id,payment_id,description&transaction_date=eq.${date}`;
  const r=await fetch(`${BASE}/rest/v1/${q}`,{headers:{apikey:KEY,Authorization:`Bearer ${KEY}`}});
  const t=await r.text(); let j=[]; try{j=JSON.parse(t)}catch{}
  if(!r.ok) throw new Error(`${r.status} ${t}`);
  return j;
}

(async()=>{
  const out=[];
  for(const c of checks){
    const rows=await getRows(c.table,c.date);
    const protectedRows=rows.filter(r=>Boolean(r.parsing_lock)||Boolean(r.conversion_id));
    out.push({
      table:c.table,
      date:c.date,
      total:rows.length,
      protectedCount:protectedRows.length,
      protectedRows:protectedRows.slice(0,20)
    });
  }
  console.log(JSON.stringify(out,null,2));
})();
