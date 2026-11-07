import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_ORGS, demoApi, resetPublicDemo } from '../lib/demo-store.ts';
const memory=new Map();
globalThis.localStorage={getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,String(value)),removeItem:key=>memory.delete(key)};
const base='/api/';
test('public demo has two clearly labeled synthetic organizations',async()=>{
 const orgs=await demoApi(base+'organizations');
 assert.equal(orgs.length,2);assert(orgs.every(x=>x.org.isDemo));
});
test('every navigation section has substantial isolated data',async()=>{
 for(const o of DEMO_ORGS){
  const q=`?orgId=${o.id}`;
  for(const resource of ['accounts','journals','parties','invoices','treasury','movements','budgets','periods','centers','projects','recurring','installments','statements','members','audit','branches']){
   const rows=await demoApi(`${base}${resource}${q}`);assert(Array.isArray(rows),`${resource} is an array`);assert(rows.length>=6,`${resource} has sample data`);
  }
  assert((await demoApi(base+'journals'+q)).length>=150);
  assert((await demoApi(base+'invoices'+q)).length>=120);
  const metrics=await demoApi(base+'dashboard'+q);assert(metrics.chart.length===6);assert(BigInt(metrics.revenue)>=0n);
  for(const type of ['trial','ledger','income','balance','aging','cashflow','budget','projects','forecast']){
   const report=await demoApi(`${base}reports?orgId=${o.id}&type=${type}`);assert(Array.isArray(report.rows),`${type} rows`);
  }
  const t=await demoApi(base+`reports?orgId=${o.id}&type=trial`);
  assert.equal(t.totalDebit,t.totalCredit,'posted demo accounting remains balanced');
 }
});
test('public edits remain local and never leak across organizations',async()=>{
 resetPublicDemo();const orgId=DEMO_ORGS[0].id,other=DEMO_ORGS[1].id;
 const name='رکورد آزمایشی ویرایش مستقل';
 const n=await demoApi(base+'parties',{method:'POST',body:{orgId,name,kind:'CUSTOMER'}});
 assert((await demoApi(base+`parties?orgId=${orgId}`)).some(x=>x.id===n.id));
 assert(!(await demoApi(base+`parties?orgId=${other}`)).some(x=>x.id===n.id));
 resetPublicDemo();assert(!(await demoApi(base+`parties?orgId=${orgId}`)).some(x=>x.id===n.id));
});
test('public demo rejects unbalanced journal posting',async()=>{
 const orgId=DEMO_ORGS[0].id;
 const journals=await demoApi(base+`journals?orgId=${orgId}`),draft=journals.find(j=>j.status==='DRAFT');
 assert(draft,'contains draft');
 await demoApi(`${base}journals/${draft.id}/save`,{method:'POST',body:{orgId,lines:draft.lines.map((l,i)=>({...l,credit:i===1?'1':l.credit}))}});
 await assert.rejects(()=>demoApi(`${base}journals/${draft.id}/post`,{method:'POST',body:{orgId}}),/تراز/);
});
