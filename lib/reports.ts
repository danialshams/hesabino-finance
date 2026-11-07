import { AccountType } from '@prisma/client';
import { prisma } from './prisma';
import { toIsoDate } from './money';

type LedgerLine = { accountId: string; centerId:string|null; projectId:string|null; debit: bigint; credit: bigint; date: Date; memo: string; number: string | null; journalId: string };
export async function financialReport(orgId: string, type: string, fromRaw?: string|null, toRaw?:string|null, accountId?:string|null) {
  const from=fromRaw&&type!=='balance'?toIsoDate(fromRaw):new Date('2000-01-01'), to=toRaw?toIsoDate(toRaw):new Date('2100-01-01');
  if(from>to) throw new Error('تاریخ شروع بعد از پایان است');
  const [accounts,journals,invoices,movements,budgets] = await Promise.all([
    prisma.account.findMany({where:{orgId},orderBy:{code:'asc'}}),
    prisma.journal.findMany({where:{orgId,status:{in:['POSTED','REVERSED']},bookedAt:{gte:from,lte:to}},include:{lines:true},orderBy:[{bookedAt:'asc'},{number:'asc'}]}),
    prisma.invoice.findMany({where:{orgId,status:{in:['ISSUED','PARTIAL','PAID']}} ,include:{party:true}}),
    prisma.treasuryMovement.findMany({where:{orgId,status:'POSTED',occurredAt:{gte:from,lte:to}},orderBy:{occurredAt:'asc'}}),
    prisma.budget.findMany({where:{orgId}})
  ]);
  const lines:LedgerLine[]=journals.flatMap(j=>j.lines.map(l=>({accountId:l.accountId,debit:l.debit,credit:l.credit,date:j.bookedAt,memo:j.memo,number:j.number,journalId:j.id,centerId:l.centerId,projectId:l.projectId})));
  const totals=new Map(accounts.map(a=>[a.id,{accountId:a.id,code:a.code,name:a.name,type:a.type,debit:0n,credit:0n,balance:0n}]));
  for(const l of lines){ const row=totals.get(l.accountId);if(row){row.debit+=l.debit;row.credit+=l.credit;row.balance+=l.debit-l.credit;} }
  const rows=[...totals.values()];
  if(type==='ledger'){
    const selected=accountId ? accounts.find(a=>a.id===accountId):null;
    if(accountId && !selected) throw new Error('حساب انتخاب‌شده معتبر نیست');
    let balance=0n;
    return {type, account:selected,rows:lines.filter(l=>!accountId||l.accountId===accountId).map(l=>{balance+=l.debit-l.credit;return {...l,balance};})};
  }
  if(type==='trial'){
    return {type, rows:rows.filter(x=>x.debit!==0n||x.credit!==0n).map(x=>({...x,closingDebit:x.balance>0n?x.balance:0n,closingCredit:x.balance<0n?-x.balance:0n})),totalDebit:rows.reduce((a,r)=>a+r.debit,0n),totalCredit:rows.reduce((a,r)=>a+r.credit,0n)};
  }
  if(type==='income'){
    const revenue=rows.filter(r=>r.type==='REVENUE').reduce((a,r)=>a-r.balance,0n);
    const expenses=rows.filter(r=>r.type==='EXPENSE').reduce((a,r)=>a+r.balance,0n);
    return {type,rows:rows.filter(r=>r.type==='REVENUE'||r.type==='EXPENSE'),revenue,expenses,profit:revenue-expenses};
  }
  if(type==='balance'){
    const assets=rows.filter(r=>r.type==='ASSET').reduce((a,r)=>a+r.balance,0n);
    const liabilities=rows.filter(r=>r.type==='LIABILITY').reduce((a,r)=>a-r.balance,0n);
    const equity=rows.filter(r=>r.type==='EQUITY').reduce((a,r)=>a-r.balance,0n);
    const operatingProfit=rows.filter(r=>r.type==='REVENUE').reduce((a,r)=>a-r.balance,0n)-rows.filter(r=>r.type==='EXPENSE').reduce((a,r)=>a+r.balance,0n);
    return {type,rows:rows.filter(r=>['ASSET','LIABILITY','EQUITY'].includes(r.type)),assets,liabilities,equity,operatingProfit,isBalanced:assets===liabilities+equity+operatingProfit};
  }
  if(type==='aging'){
    const now=new Date(); const ms=24*3600*1000;
    return {type,rows:invoices.filter(i=>i.paid<i.total).map(i=>({number:i.number,party:i.party.name,kind:i.kind,dueAt:i.dueAt,total:i.total,paid:i.paid,balance:i.total-i.paid,daysOverdue:i.dueAt?Math.max(0,Math.floor((now.valueOf()-i.dueAt.valueOf())/ms)):0}))};
  }
  if(type==='cashflow'){
    const receipt=movements.filter(m=>m.kind==='RECEIPT').reduce((a,m)=>a+m.amount,0n);
    const payment=movements.filter(m=>m.kind==='PAYMENT').reduce((a,m)=>a+m.amount,0n);
    return {type,rows:movements.map(m=>({id:m.id,date:m.occurredAt,kind:m.kind,amount:m.amount,memo:m.memo})),receipt,payment,net:receipt-payment};
  }
  if(type==='budget'){
    const report=budgets.map(b=>{
      const spent=lines.filter(l=>l.accountId===b.accountId&&l.date>=b.startsAt&&l.date<=b.endsAt&&(!b.centerId||l.centerId===b.centerId)).reduce((a,l)=>a+l.debit-l.credit,0n);
      return {id:b.id,name:b.name,limit:b.limit,spent,remaining:b.limit-spent,overBudget:spent>b.limit};
    });
    return {type,rows:report};
  }
  if(type==='projects'){
    const projects=await prisma.financialProject.findMany({where:{orgId}});
    return {type,rows:projects.map(p=>{
      const projectLines=lines.filter(l=>l.projectId===p.id);
      const revenue=projectLines.filter(l=>accounts.some(a=>a.id===l.accountId&&a.type==='REVENUE')).reduce((a,l)=>a+l.credit-l.debit,0n);
      const expense=projectLines.filter(l=>accounts.some(a=>a.id===l.accountId&&a.type==='EXPENSE')).reduce((a,l)=>a+l.debit-l.credit,0n);
      return {project:p.name,revenue,expenses:expense,profit:revenue-expense};
    })};
  }
  if(type==='forecast'){
    const start=new Date();start.setUTCHours(0,0,0,0);
    const futureInvoices=invoices.filter(i=>i.total>i.paid&&i.dueAt&&i.dueAt>=start);
    const months=Array.from({length:6},(_,offset)=>{
      const monthStart=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+offset,1));
      const monthEnd=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+offset+1,1));
      const inPeriod=futureInvoices.filter(i=>i.dueAt!>=monthStart&&i.dueAt!<monthEnd);
      const inflow=inPeriod.filter(i=>i.kind==='SALE').reduce((a,i)=>a+i.total-i.paid,0n);
      const outflow=inPeriod.filter(i=>i.kind==='PURCHASE').reduce((a,i)=>a+i.total-i.paid,0n);
      return {month:monthStart.toISOString().slice(0,7),expectedInflow:inflow,expectedOutflow:outflow,net:inflow-outflow};
    });
    return {type,rows:months,disclaimer:'برآورد بر اساس سررسید فاکتورهای باز؛ تضمین دریافت یا پرداخت نیست'};
  }
  throw new Error('نوع گزارش پشتیبانی نمی‌شود');
}
export async function dashboardData(orgId:string){
 const now=new Date(), start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1));
 const [report,aging,cash,budget,activity] = await Promise.all([
   financialReport(orgId,'income',start.toISOString(),now.toISOString()), financialReport(orgId,'aging'),financialReport(orgId,'cashflow',start.toISOString(),now.toISOString()),financialReport(orgId,'budget'),
   prisma.auditLog.findMany({where:{orgId},orderBy:{occurredAt:'desc'},take:8})
 ]);
 const profit=report as {revenue:bigint;expenses:bigint;profit:bigint};
 const age=aging as {rows:{daysOverdue:number;balance:bigint}[]};
 const flow=cash as {receipt:bigint;payment:bigint;net:bigint};
 const bg=budget as {rows:{overBudget:boolean}[]};
 const monthly = await prisma.journal.findMany({where:{orgId,status:{in:['POSTED','REVERSED']},bookedAt:{gte:new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-5,1))}},include:{lines:{include:{account:{select:{type:true}}}}}});
 const chart=Array.from({length:6},(_,i)=>{const date=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-5+i,1));return {month:date.toLocaleDateString('fa-IR-u-ca-persian',{month:'short',year:'2-digit'}),start:date.valueOf(),end:new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,1)).valueOf(),revenue:0n,expense:0n};});
 for(const j of monthly) {const m=chart.find(x=>j.bookedAt.valueOf()>=x.start&&j.bookedAt.valueOf()<x.end);if(!m)continue;for(const l of j.lines){if(l.account.type==='REVENUE')m.revenue+=l.credit-l.debit;if(l.account.type==='EXPENSE')m.expense+=l.debit-l.credit;}}
 return {revenue:profit.revenue,expenses:profit.expenses,profit:profit.profit,cashIn:flow.receipt,cashOut:flow.payment,cashNet:flow.net,overdueCount:age.rows.filter(i=>i.daysOverdue>0).length,overdueBalance:age.rows.filter(i=>i.daysOverdue>0).reduce((a,i)=>a+i.balance,0n),overBudget:bg.rows.filter(x=>x.overBudget).length,chart:chart.map(({month,revenue,expense})=>({month,revenue,expense})),activity};
}
