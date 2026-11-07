/** Browser-only, isolated public demo. No request is sent to a financial API. */
type Item = Record<string, any>;
type DemoData = Record<string, Item[]>;
type DemoState = Record<string, DemoData>;
const KEY = 'hesabino_public_demo_v2';
export const DEMO_ORGS = [
  { id: 'hesabino-demo-afogh', name: 'گروه فناوری افق (نمایشی)', isDemo: true },
  { id: 'hesabino-demo-novin', name: 'بازرگانی نوین (نمایشی)', isDemo: true },
];
export const DEMO_USER = { id: 'visitor', name: 'بازدیدکننده دمو', email: 'demo@example.com' };
const iso = (date: Date) => date.toISOString().slice(0, 10);
const dateShift = (days: number) => { const d = new Date(); d.setUTCHours(12, 0, 0, 0); d.setUTCDate(d.getUTCDate() + days); return iso(d); };
const rials = (n: number) => String(Math.round(n));
const safe = (x: unknown) => { try { return BigInt(String(x ?? '0')); } catch { return 0n; } };
const serial = (x: bigint) => x.toString();
const humanNames = ['آوا','پارسا','نیکان','رادمان','سپهر','نیکی','سینا','آرین','مانی','کیان','آناهیتا','هستی','رها','دانا','بهار'];
const expenseNames = ['حقوق و دستمزد','اجاره دفتر','تبلیغات دیجیتال','لوازم مصرفی','انرژی و خدمات','لجستیک','هزینه نرم‌افزار','پشتیبانی','آموزش کارکنان','سفر سازمانی'];
const categories = ['ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE'];
function generate(orgIndex: number): DemoData {
  const orgId = DEMO_ORGS[orgIndex].id, prefix = `demo-${orgIndex}`;
  const id = (type: string, n: number) => `${prefix}-${type}-${n}`;
  const accounts: Item[] = [
    ['1101','بانک‌های ریالی','ASSET'],['1102','صندوق مرکزی','ASSET'],['1201','حساب‌های دریافتنی','ASSET'],['1301','موجودی کالا','ASSET'],['1401','پیش‌پرداخت‌ها','ASSET'],
    ['2101','حساب‌های پرداختنی','LIABILITY'],['2201','مالیات پرداختنی','LIABILITY'],['2301','وام کوتاه‌مدت','LIABILITY'],
    ['3101','سرمایه','EQUITY'],['3201','سود انباشته','EQUITY'],
    ['4101','درآمد فروش کالا','REVENUE'],['4102','درآمد خدمات','REVENUE'],['4103','درآمد پروژه','REVENUE'],
    ['5101','هزینه حقوق','EXPENSE'],['5102','هزینه اجاره','EXPENSE'],['5103','هزینه بازاریابی','EXPENSE'],['5104','هزینه عملیاتی','EXPENSE'],['5105','هزینه پشتیبانی','EXPENSE'],
    ...Array.from({length:18},(_,i)=>[`${i<9?'42':'52'}${String(i+1).padStart(2,'0')}`,i<9?`درآمد خدمات تخصصی ${i+1}`:`هزینه اداری ${i-8}`,i<9?'REVENUE':'EXPENSE'])
  ].map(([code,name,type],i)=>({id:id('account',i),orgId,code,name,type,createdAt:dateShift(-280),isActive:true,parentId:null}));
  const acc = (code: string) => accounts.find(a=>a.code===code)?.id;
  const centers = Array.from({length:12},(_,i)=>({id:id('center',i),orgId,name:['مرکز تهران','تیم توسعه','فروش سازمانی','بازاریابی','زیرساخت','دفتر مرکزی','شعبه شمال','تیم پشتیبانی','آموزش','تحقیق و توسعه','منابع انسانی','لجستیک'][i]}));
  const projects = Array.from({length:16},(_,i)=>({id:id('project',i),orgId,name:`پروژه نمونه ${String(i+1).padStart(2,'0')}`,code:`PRJ-${100+i}`}));
  const branches = Array.from({length:6},(_,i)=>({id:id('branch',i),orgId,name:['دفتر مرکزی','شعبه غرب','شعبه شمال','شعبه شرق','شعبه جنوب','دفتر توسعه'][i],address:'آدرس نمونه، صرفاً جهت نمایش'}));
  const parties = Array.from({length:78},(_,i)=>({id:id('party',i),orgId,kind:i%7===0?'BOTH':i%3===0?'SUPPLIER':'CUSTOMER',name:`${i%3===0?'تأمین‌کننده':'مشتری'} نمونه ${humanNames[i%humanNames.length]} ${i+1}`,phone:'شماره آزمایشی',email:`contact${i+1}@example.com`,address:'اطلاعات ساختگی جهت نمایش',createdAt:dateShift(-300+i)}));
  const treasury = Array.from({length:6},(_,i)=>({id:id('treasury',i),orgId,name:['حساب جاری اصلی','حساب عملیات','صندوق مرکزی','حساب تنخواه','حساب ذخیره','صندوق شعبه'][i],kind:i===2||i===5?'CASH':'BANK',bankName:i===2||i===5?'':`بانک نمایشی ${i+1}`,iban:'شماره شبا نمایشی',accountId:acc(i===2||i===5?'1102':'1101'),account:{name:i===2||i===5?'صندوق مرکزی':'بانک‌های ریالی',code:i===2||i===5?'1102':'1101'},active:true}));
  const periods = Array.from({length:12},(_,i)=>{const today=new Date(),first=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth()-10+i,1)),last=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth()-9+i,0));return {id:id('period',i),orgId,name:`دوره ${i+1} · ${new Intl.DateTimeFormat('fa-IR-u-ca-persian',{month:'long',year:'numeric'}).format(first)}`,startsAt:iso(first),endsAt:iso(last),status:i<8?'CLOSED':'OPEN'};});
  const journals = Array.from({length:180},(_,i)=>{
    const income = i%5!==0, amount=BigInt(25000000+(i*7349211)%460000000+(orgIndex*12000000));
    const debit=acc(income?(i%4===0?'1201':'1101'):(i%3===0?'5101':i%3===1?'5102':'5104'));
    const credit=acc(income?(i%3===0?'4102':i%3===1?'4103':'4101'):'1101');
    const bookedAt=dateShift(-i*2),status=i%41===0?'DRAFT':'POSTED';
    return {id:id('journal',i),orgId,number:status==='POSTED'?`JV-${String(3000+i).padStart(5,'0')}`:null,memo:income?`ثبت درآمد نمونه · قرارداد ${i+1}`:expenseNames[i%expenseNames.length],bookedAt,status,source:i%3===0?'MANUAL':'INVOICE',sourceId:null,periodId:periods.find(p=>bookedAt>=p.startsAt&&bookedAt<=p.endsAt)?.id??null,createdAt:bookedAt,createdBy:'demo-user',lines:[{id:id('line',i*2),journalId:id('journal',i),accountId:debit,debit:serial(amount),credit:'0',centerId:centers[i%12].id,projectId:projects[i%16].id,account:{code:accounts.find(a=>a.id===debit)?.code,name:accounts.find(a=>a.id===debit)?.name}},{id:id('line',i*2+1),journalId:id('journal',i),accountId:credit,debit:'0',credit:serial(amount),centerId:null,projectId:projects[i%16].id,account:{code:accounts.find(a=>a.id===credit)?.code,name:accounts.find(a=>a.id===credit)?.name}}]};
  });
  const invoices = Array.from({length:135},(_,i)=>{
    const total=BigInt(76000000+(i*4381007)%380000000),paid=i%8===0?total:i%5===0?total/2n:0n;
    const status=i%19===0?'DRAFT':paid===total?'PAID':paid>0?'PARTIAL':'ISSUED';
    const party=parties[(i*7)%parties.length];
    return {id:id('invoice',i),orgId,number:`${i%6===0?'PUR':'INV'}-${String(5000+i)}`,partyId:party.id,party:{name:party.name},kind:i%6===0?'PURCHASE':'SALE',status,issuedAt:dateShift(-i*3),dueAt:dateShift(-i*3+30),total:serial(total),subtotal:serial(total),discount:'0',tax:'0',paid:serial(paid),memo:`فاکتور نمونه ${i+1}`,lines:[{description:`خدمات نمونه شماره ${i+1}`,quantity:1,unitPrice:serial(total),discount:'0',tax:'0'}]};
  });
  const movements = Array.from({length:114},(_,i)=>({id:id('movement',i),orgId,kind:i%9===0?'TRANSFER':i%4===0?'PAYMENT':'RECEIPT',status:i%31===0?'DRAFT':'POSTED',amount:rials(18000000+(i*1337127)%260000000),occurredAt:dateShift(-i*2),sourceId:treasury[i%6].id,destinationId:treasury[(i+2)%6].id,partyId:parties[i%parties.length].id,invoiceId:invoices[i%invoices.length].id,memo:`تراکنش نمایشی ${i+1}`,reference:`TX-${100000+i}`,createdAt:dateShift(-i*2)}));
  const statements = Array.from({length:92},(_,i)=>({id:id('statement',i),orgId,treasuryId:treasury[i%6].id,occurredAt:dateShift(-i*2),amount:rials((i%4===0?-1:1)*(12000000+(i*3442433)%120000000)),reference:`ST-${10000+i}`,movementId:i%4===0?null:movements[i%movements.length].id,status:i%4===0?'UNMATCHED':'MATCHED'}));
  const budgets=Array.from({length:25},(_,i)=>({id:id('budget',i),orgId,name:`بودجه ${expenseNames[i%expenseNames.length]} ${i+1}`,accountId:acc(['5101','5102','5103','5104','5105'][i%5]),account:{name:expenseNames[i%expenseNames.length]},centerId:centers[i%12].id,startsAt:dateShift(-65),endsAt:dateShift(125),limit:rials(160000000+i*26000000)}));
  const installments=Array.from({length:78},(_,i)=>({id:id('installment',i),orgId,invoiceId:invoices[i].id,invoice:{number:invoices[i].number,party:invoices[i].party},dueAt:dateShift(i*4-70),amount:rials(32000000+i*1700000),paid:i%3===0?rials(32000000+i*1700000):'0',status:i%3===0?'PAID':'PENDING'}));
  const recurring=Array.from({length:15},(_,i)=>({id:id('recurring',i),orgId,name:`${expenseNames[i%expenseNames.length]} · پرداخت ماهانه`,amount:rials(42000000+i*5000000),debitAccountId:acc('5104'),creditAccountId:acc('1101'),nextAt:dateShift(i*3),intervalMonths:1+(i%3),active:i%8!==0}));
  const members=Array.from({length:8},(_,i)=>({id:id('membership',i),orgId,role:['OWNER','ADMIN','ACCOUNTANT','ACCOUNTANT','FINANCE_MANAGER','VIEWER','VIEWER','ACCOUNTANT'][i],user:{name:`کاربر آزمایشی ${humanNames[i]}`,email:`demo-staff${i}@example.com`}}));
  const audit=Array.from({length:105},(_,i)=>({id:id('audit',i),orgId,action:['CREATE','UPDATE','POST','VIEW','REVERSE'][i%5],entity:['invoice','journal','movement','budget','party'][i%5],entityId:id('audit-entity',i),actorId:`demo-staff${i%8}`,occurredAt:dateShift(-i)}));
  return {accounts,journals,parties,invoices,treasury,movements,budgets,periods,centers,projects,recurring,installments,statements,members,audit,branches};
}
function getState(): DemoState {
  try { const data=localStorage.getItem(KEY);if(data) {const parsed=JSON.parse(data) as DemoState;if(parsed[DEMO_ORGS[0].id]?.journals?.length)return parsed;} } catch{}
  return Object.fromEntries(DEMO_ORGS.map((org,i)=>[org.id,generate(i)]));
}
function save(state: DemoState){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{/* Quota/private mode: demo remains navigable */}}
export function resetPublicDemo(){try{localStorage.removeItem(KEY);}catch{}}
const asRow=(x: Item)=>(x && typeof x==='object'?x:{});
function report(collections: DemoData,type: string, q:URLSearchParams):Item {
  const from=q.get('from')||'1900-01-01',to=q.get('to')||'2100-01-01';
  const accountById=new Map(collections.accounts.map(a=>[a.id,a]));
  const active=collections.journals.filter(j=>j.status!=='DRAFT' && j.bookedAt>=from && j.bookedAt<=to);
  const ledger: Array<{journalId:string;accountId:string;code:string;name:string;date:string;memo:string;number:string|null;debit:bigint;credit:bigint;centerId:string|null;projectId:string|null}>=active.flatMap(j=>j.lines.map((l:Item)=>({journalId:j.id,accountId:l.accountId,code:accountById.get(l.accountId)?.code,name:accountById.get(l.accountId)?.name,date:j.bookedAt,memo:j.memo,number:j.number,debit:safe(l.debit),credit:safe(l.credit),centerId:l.centerId,projectId:l.projectId})));
  const byAccount: Array<Item & {debit:bigint;credit:bigint;balance:bigint}>=collections.accounts.map(a=>{const xs=ledger.filter(l=>l.accountId===a.id),debit=xs.reduce<bigint>((t,l)=>t+l.debit,0n),credit=xs.reduce<bigint>((t,l)=>t+l.credit,0n),balance=debit-credit;return {...a,debit,credit,balance};});
  const compact=(x:Item)=>Object.fromEntries(Object.entries(x).map(([k,v])=>[k,typeof v==='bigint'?serial(v):v]));
  const revenue=byAccount.filter(a=>a.type==='REVENUE').reduce<bigint>((t,a)=>t-a.balance,0n),expenses=byAccount.filter(a=>a.type==='EXPENSE').reduce<bigint>((t,a)=>t+a.balance,0n);
  if(type==='trial')return {type,rows:byAccount.filter(a=>a.debit||a.credit).map(a=>compact({code:a.code,name:a.name,debit:a.debit,credit:a.credit,closingDebit:a.balance>0n?a.balance:0n,closingCredit:a.balance<0n?-a.balance:0n})),totalDebit:serial(ledger.reduce<bigint>((t,l)=>t+l.debit,0n)),totalCredit:serial(ledger.reduce<bigint>((t,l)=>t+l.credit,0n))};
  if(type==='income')return {type,revenue:serial(revenue),expenses:serial(expenses),profit:serial(revenue-expenses),rows:byAccount.filter(a=>a.type==='REVENUE'||a.type==='EXPENSE').map(a=>compact({code:a.code,name:a.name,debit:a.debit,credit:a.credit,balance:a.balance}))};
  if(type==='ledger'){let running=0n;return {type,rows:ledger.filter(l=>!q.get('accountId')||q.get('accountId')===l.accountId).map(l=>{running+=l.debit-l.credit;return compact({...l,balance:running});})};}
  if(type==='balance'){const sum=(t:string,sign:bigint)=>byAccount.filter(a=>a.type===t).reduce<bigint>((n,a)=>n+a.balance*sign,0n);return {type,assets:serial(sum('ASSET',1n)),liabilities:serial(sum('LIABILITY',-1n)),equity:serial(sum('EQUITY',-1n)),operatingProfit:serial(revenue-expenses),rows:byAccount.filter(a=>['ASSET','LIABILITY','EQUITY'].includes(a.type)).map(a=>compact({code:a.code,name:a.name,type:a.type,balance:a.balance}))};}
  if(type==='aging')return {type,rows:collections.invoices.filter(i=>i.status!=='DRAFT'&&safe(i.total)>safe(i.paid)).map(i=>({number:i.number,party:i.party.name,kind:i.kind,dueAt:i.dueAt,total:i.total,paid:i.paid,balance:serial(safe(i.total)-safe(i.paid)),daysOverdue:Math.max(0,Math.floor((new Date().valueOf()-new Date(i.dueAt).valueOf())/86400000))}))};
  if(type==='cashflow'){const xs=collections.movements.filter(m=>m.status==='POSTED'&&m.occurredAt>=from&&m.occurredAt<=to),receipt=xs.filter(m=>m.kind==='RECEIPT').reduce<bigint>((n,m)=>n+safe(m.amount),0n),payment=xs.filter(m=>m.kind==='PAYMENT').reduce<bigint>((n,m)=>n+safe(m.amount),0n);return {type,receipt:serial(receipt),payment:serial(payment),net:serial(receipt-payment),rows:xs.map(m=>({date:m.occurredAt,kind:m.kind,amount:m.amount,memo:m.memo}))};}
  if(type==='budget')return {type,rows:collections.budgets.map(b=>{const spent=ledger.filter(l=>l.accountId===b.accountId&&l.date>=b.startsAt&&l.date<=b.endsAt).reduce<bigint>((n,l)=>n+l.debit-l.credit,0n);return {name:b.name,limit:b.limit,spent:serial(spent),remaining:serial(safe(b.limit)-spent),overBudget:spent>safe(b.limit)}})};
  if(type==='projects')return {type,rows:collections.projects.map(p=>{const xs=ledger.filter(l=>l.projectId===p.id),income=xs.filter(l=>accountById.get(l.accountId)?.type==='REVENUE').reduce<bigint>((n,l)=>n+l.credit-l.debit,0n),out=xs.filter(l=>accountById.get(l.accountId)?.type==='EXPENSE').reduce<bigint>((n,l)=>n+l.debit-l.credit,0n);return {project:p.name,revenue:serial(income),expenses:serial(out),profit:serial(income-out)}})};
  if(type==='forecast')return {type,rows:Array.from({length:6},(_,i)=>{const d=new Date(),start=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+i,1)),month=iso(start).slice(0,7);const xs=collections.invoices.filter(inv=>inv.dueAt?.startsWith(month)&&safe(inv.total)>safe(inv.paid));const income=xs.filter(inv=>inv.kind==='SALE').reduce<bigint>((n,inv)=>n+safe(inv.total)-safe(inv.paid),0n),out=xs.filter(inv=>inv.kind==='PURCHASE').reduce<bigint>((n,inv)=>n+safe(inv.total)-safe(inv.paid),0n);return {month,expectedInflow:serial(income),expectedOutflow:serial(out),net:serial(income-out)};})};
  return {type,rows:[]};
}
function overview(c: DemoData):Item {
 const now=new Date(),start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)),month=iso(start).slice(0,7);
 const incoming=c.journals.filter(j=>j.status==='POSTED'&&j.bookedAt.startsWith(month));
 const revenue=incoming.flatMap(j=>j.lines).filter(l=>c.accounts.some(a=>a.id===l.accountId&&a.type==='REVENUE')).reduce<bigint>((n,l)=>n+safe(l.credit)-safe(l.debit),0n);
 const expenses=incoming.flatMap(j=>j.lines).filter(l=>c.accounts.some(a=>a.id===l.accountId&&a.type==='EXPENSE')).reduce<bigint>((n,l)=>n+safe(l.debit)-safe(l.credit),0n);
 const received=c.movements.filter(m=>m.kind==='RECEIPT'&&m.status==='POSTED'&&m.occurredAt.startsWith(month)).reduce<bigint>((n,m)=>n+safe(m.amount),0n),paid=c.movements.filter(m=>m.kind==='PAYMENT'&&m.status==='POSTED'&&m.occurredAt.startsWith(month)).reduce<bigint>((n,m)=>n+safe(m.amount),0n);
 const overdue=c.invoices.filter(i=>i.status!=='DRAFT'&&i.dueAt<dateShift(0)&&safe(i.total)>safe(i.paid));
 const chart=Array.from({length:6},(_,i)=>{const dt=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-5+i,1)),key=iso(dt).slice(0,7),lines=c.journals.filter(j=>j.status==='POSTED'&&j.bookedAt.startsWith(key)).flatMap(j=>j.lines);const r=lines.filter(l=>c.accounts.some(a=>a.id===l.accountId&&a.type==='REVENUE')).reduce<bigint>((n,l)=>n+safe(l.credit)-safe(l.debit),0n),e=lines.filter(l=>c.accounts.some(a=>a.id===l.accountId&&a.type==='EXPENSE')).reduce<bigint>((n,l)=>n+safe(l.debit)-safe(l.credit),0n);return {month:new Intl.DateTimeFormat('fa-IR-u-ca-persian',{month:'short'}).format(dt),revenue:serial(r),expense:serial(e)};});
 return {revenue:serial(revenue),expenses:serial(expenses),profit:serial(revenue-expenses),cashIn:serial(received),cashOut:serial(paid),cashNet:serial(received-paid),overdueCount:overdue.length,overdueBalance:serial(overdue.reduce<bigint>((n,i)=>n+safe(i.total)-safe(i.paid),0n)),overBudget:c.budgets.length>=10?3:0,chart,activity:c.audit.slice(0,8)};
}
function validateJournal(j:Item) {
 if(!Array.isArray(j.lines)||j.lines.length<2)throw new Error('سند حداقل دو ردیف می‌خواهد');
 let deb=0n,cred=0n;
 for(const l of j.lines){const d=safe(l.debit),c=safe(l.credit);if(!l.accountId||d<0n||c<0n||(d===0n&&c===0n)||(d>0n&&c>0n))throw new Error('ردیف سند معتبر نیست');deb+=d;cred+=c;}
 if(deb===0n||deb!==cred)throw new Error('سند باید تراز باشد');
}
export async function demoApi(path:string,opts?:{method?:string;body?:unknown}):Promise<any> {
 const u=new URL(path,'https://local.invalid'),endpoint=u.pathname.split('/').filter(Boolean).slice(1),resource=endpoint[0],action=endpoint[2];
 const method=(opts?.method||'GET').toUpperCase(),body=asRow(opts?.body as Item),state=getState();
 if(resource==='organizations'){
   if(method==='GET')return DEMO_ORGS.map(o=>({id:`member-${o.id}`,org:o,role:'OWNER'}));
   throw new Error('ایجاد شرکت واقعی در نسخه نمایش عمومی فعال نیست');
 }
 if(resource==='auth')return {success:true};
 const orgId=(method==='GET'?u.searchParams.get('orgId'):body.orgId)||DEMO_ORGS[0].id;
 const data=state[orgId];if(!data)throw new Error('شرکت آزمایشی معتبر نیست');
 if(resource==='dashboard')return overview(data);
 if(resource==='reports')return report(data,u.searchParams.get('type')||'trial',u.searchParams);
 if(!data[resource])throw new Error('بخش درخواست‌شده موجود نیست');
 if(method==='GET')return data[resource];
 const records=data[resource],target=endpoint[1]?records.find(r=>r.id===endpoint[1]):records.find(r=>r.id===body.id);
 if(endpoint[1]&&action){
   if(!target)throw new Error('رکورد آزمایشی یافت نشد');
   if(action==='post'){if(target.status!=='DRAFT')throw new Error('قبلاً قطعی شده');if(resource==='journals')validateJournal(target);target.status='POSTED';target.number=target.number||`DEMO-${Date.now().toString().slice(-7)}`;}
   else if(action==='issue'){if(target.status!=='DRAFT')throw new Error('فاکتور قبلاً صادر شده');target.status='ISSUED';}
   else if(action==='reverse'){if(target.status!=='POSTED')throw new Error('فقط سند قطعی قابل برگشت است');target.status='REVERSED';const rev={...target,id:`demo-reversal-${Date.now()}`,number:`REV-${Date.now().toString().slice(-6)}`,memo:`برگشت سند ${target.number}`,lines:target.lines.map((l:Item)=>({...l,id:`rev-${l.id}`,debit:l.credit,credit:l.debit})),bookedAt:dateShift(0),status:'POSTED',source:'REVERSAL'};records.unshift(rev);}
   else if(action==='close'){target.status='CLOSED';}
   else if(action==='run'){const newJournal={id:`demo-run-${Date.now()}`,orgId,number:`REC-${Date.now().toString().slice(-6)}`,memo:target.name,bookedAt:dateShift(0),status:'POSTED',source:'RECURRING',lines:[{accountId:target.debitAccountId,debit:target.amount,credit:'0'},{accountId:target.creditAccountId,debit:'0',credit:target.amount}]};data.journals.unshift(newJournal);}
   else if(action==='save'){if(target.status!=='DRAFT')throw new Error('سند قطعی قابل ویرایش نیست');Object.assign(target,body);}
   else throw new Error('عملیات پشتیبانی نمی‌شود');
   save(state);return target;
 }
 if(method==='POST'){
   const row:Item={...body,id:`demo-new-${resource}-${Date.now()}-${Math.floor(Math.random()*1000)}`,orgId};
   if(resource==='journals'){row.status='DRAFT';row.lines=(body.lines||[]).map((x:Item,i:number)=>({...x,id:`demo-line-new-${Date.now()}-${i}`}));validateJournal(row);}
   if(resource==='invoices'){row.status='DRAFT';row.number=`INV-DEMO-${Date.now().toString().slice(-6)}`;row.total=serial((body.lines||[]).reduce((n:bigint,l:Item)=>n+safe(l.unitPrice)*BigInt(l.quantity||1)-safe(l.discount)+safe(l.tax),0n));row.paid='0';row.party={name:data.parties.find(p=>p.id===row.partyId)?.name||'طرف حساب'};}
   if(resource==='movements')row.status='DRAFT';
   if(resource==='periods')row.status='OPEN';
   if(resource==='accounts')row.isActive=true;
   if(resource==='treasury')row.account={name:data.accounts.find(a=>a.id===row.accountId)?.name||'حساب'};
   if(resource==='budgets')row.account={name:data.accounts.find(a=>a.id===row.accountId)?.name||'هزینه'};
   if(resource==='installments'){row.status='PENDING';row.invoice={number:data.invoices.find(i=>i.id===row.invoiceId)?.number||'نمایشی'};}
   records.unshift(row);save(state);return row;
 }
 if(method==='PATCH'){
   if(!target)throw new Error('رکورد یافت نشد');
   if(['journals','invoices','movements'].includes(resource)&&target.status!=='DRAFT')throw new Error('رکورد قطعی قابل ویرایش نیست');
   Object.assign(target,body);if(resource==='statements'&&body.movementId)target.status='MATCHED';save(state);return target;
 }
 if(method==='DELETE'){
   if(!target)throw new Error('رکورد یافت نشد');if(['journals','invoices'].includes(resource)&&target.status!=='DRAFT')throw new Error('رکورد قطعی حذف نمی‌شود');
   data[resource]=records.filter(r=>r.id!==target.id);save(state);return {success:true};
 }
 throw new Error('درخواست نسخه دمو پشتیبانی نمی‌شود');
}
