import { AccountType, InvoiceKind, Prisma } from '@prisma/client';
import { assertBalanced, positive, toIsoDate, toRials } from './money';
import { prisma } from './prisma';

type Tx = Prisma.TransactionClient;
export type LineInput = { accountId: string; debit: bigint; credit: bigint; description?: string | null; centerId?: string | null; projectId?: string | null };

async function audit(tx: Tx, orgId: string, actorId: string, action: string, entity: string, entityId: string, before?: object, after?: object) {
  await tx.auditLog.create({ data: { orgId, actorId, action, entity, entityId, before: before as Prisma.InputJsonValue | undefined, after: after as Prisma.InputJsonValue | undefined } });
}
async function findOpenPeriod(tx: Tx, orgId: string, at: Date) {
  const d = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const periods = await tx.fiscalPeriod.findMany({ where: { orgId, startsAt: { lte: d }, endsAt: { gte: d }, status: 'OPEN' } });
  if (periods.length !== 1) throw new Error('این تاریخ در یک دوره مالی باز و یکتا قرار ندارد');
  return periods[0];
}
async function nextNumber(tx: Tx, orgId: string, prefix: string) {
  const counter = await tx.documentCounter.upsert({ where: { orgId_prefix: { orgId, prefix } }, create: { orgId, prefix, lastNumber: 1 }, update: { lastNumber: { increment: 1 } } });
  return `${prefix}-${String(counter.lastNumber).padStart(6, '0')}`;
}
async function validateLines(tx: Tx, orgId: string, lines: LineInput[]) {
  assertBalanced(lines);
  const ids = [...new Set(lines.map(l => l.accountId))];
  const accounts = await tx.account.findMany({ where: { orgId, id: { in: ids }, isActive: true } });
  if (accounts.length !== ids.length) throw new Error('یکی از حساب‌های سند در این شرکت معتبر نیست');
  const centerIds = [...new Set(lines.map(l=>l.centerId).filter((v):v is string=>!!v))];
  const projectIds = [...new Set(lines.map(l=>l.projectId).filter((v):v is string=>!!v))];
  if (centerIds.length !== await tx.costCenter.count({ where: { orgId, id: { in: centerIds } } })) throw new Error('مرکز هزینه نامعتبر');
  if (projectIds.length !== await tx.financialProject.count({ where: { orgId, id: { in: projectIds } } })) throw new Error('پروژه مالی نامعتبر');
}
async function createPostedJournal(tx: Tx, args: { orgId: string; actorId: string; bookedAt: Date; memo: string; source: string; sourceId: string; lines: LineInput[] }) {
  const { orgId, actorId, bookedAt, memo, source, sourceId, lines } = args;
  await validateLines(tx, orgId, lines);
  const period = await findOpenPeriod(tx, orgId, bookedAt);
  const number = await nextNumber(tx, orgId, 'JV');
  const journal = await tx.journal.create({ data: { orgId, createdBy: actorId, memo, bookedAt, source, sourceId, periodId: period.id, status: 'DRAFT', lines: { create: lines.map(l => ({ accountId: l.accountId, debit: l.debit, credit: l.credit, description: l.description, centerId: l.centerId, projectId: l.projectId })) } } });
  await tx.journal.update({ where: { id: journal.id }, data: { status: 'POSTED', number, postedAt: new Date() } });
  await audit(tx, orgId, actorId, 'POST', 'Journal', journal.id, undefined, { number, source, sourceId });
  return { ...journal, status: 'POSTED' as const, number };
}
export async function saveDraftJournal(input: { orgId: string; actorId: string; id?: string; bookedAt: unknown; memo: string; lines: { accountId: string; debit: unknown; credit: unknown; description?: string; centerId?: string; projectId?: string }[] }) {
  const bookedAt = toIsoDate(input.bookedAt);
  const lines: LineInput[] = input.lines.map(l => ({ accountId: l.accountId, debit: toRials(l.debit ?? 0), credit: toRials(l.credit ?? 0), description: l.description, centerId: l.centerId || undefined, projectId: l.projectId || undefined }));
  return prisma.$transaction(async tx => {
    await validateLines(tx, input.orgId, lines);
    const period = await findOpenPeriod(tx, input.orgId, bookedAt);
    if (input.id) {
      const journal = await tx.journal.findFirst({ where: { id: input.id, orgId: input.orgId } });
      if (!journal) throw new Error('سند یافت نشد');
      if (journal.status !== 'DRAFT') throw new Error('سند ثبت‌شده یا معکوس‌شده قابل ویرایش نیست');
      await tx.journalLine.deleteMany({ where: { journalId: input.id } });
      const updated = await tx.journal.update({ where: { id: input.id }, data: { memo: input.memo, bookedAt, periodId: period.id, lines: { create: lines.map(l=>({ ...l })) } } });
      await audit(tx, input.orgId, input.actorId, 'UPDATE', 'Journal', updated.id, { memo: journal.memo }, { memo: input.memo });
      return updated;
    }
    const created = await tx.journal.create({ data: { orgId: input.orgId, createdBy: input.actorId, bookedAt, periodId: period.id, memo: input.memo, lines: { create: lines.map(l=>({ ...l })) } } });
    await audit(tx, input.orgId, input.actorId, 'CREATE', 'Journal', created.id);
    return created;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
export async function postJournal(orgId: string, actorId: string, id: string) {
  return prisma.$transaction(async tx => {
    const journal = await tx.journal.findFirst({ where: { id, orgId }, include: { lines: true } });
    if (!journal) throw new Error('سند یافت نشد');
    if (journal.status !== 'DRAFT') throw new Error('فقط سند پیش‌نویس قابل ثبت قطعی است');
    await validateLines(tx, orgId, journal.lines);
    const period = await findOpenPeriod(tx, orgId, journal.bookedAt);
    const number = await nextNumber(tx, orgId, 'JV');
    const updated = await tx.journal.updateMany({ where: { id, orgId, status: 'DRAFT' }, data: { status: 'POSTED', number, postedAt: new Date(), periodId: period.id } });
    if (updated.count !== 1) throw new Error('سند همزمان تغییر کرده است');
    await audit(tx, orgId, actorId, 'POST', 'Journal', id, undefined, { number });
    return { id, number };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
export async function reverseJournal(orgId: string, actorId: string, id: string) {
  return prisma.$transaction(async tx => {
    const original = await tx.journal.findFirst({ where: { id, orgId }, include: { lines: true } });
    if (!original) throw new Error('سند یافت نشد');
    if (original.status !== 'POSTED') throw new Error('فقط سند قطعی قابل برگشت است');
    if (original.source !== 'MANUAL') throw new Error('برگشت سند سیستمی باید از طریق سند اصلاحی همان بخش انجام شود');
    const reversed = await createPostedJournal(tx, { orgId, actorId, bookedAt: new Date(), memo: `سند برگشت از ${original.number}`, source: 'REVERSAL', sourceId: id, lines: original.lines.map(l=>({ accountId: l.accountId, debit: l.credit, credit: l.debit, description: l.description || undefined, centerId: l.centerId || undefined, projectId: l.projectId || undefined })) });
    await tx.journal.update({ where: { id }, data: { status: 'REVERSED' } });
    await tx.journal.update({ where: { id: reversed.id }, data: { reversalOfId: id } });
    await audit(tx, orgId, actorId, 'REVERSE', 'Journal', id, undefined, { reversalId: reversed.id });
    return reversed;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
export async function addInvoice(input: { orgId: string; actorId: string; kind: InvoiceKind; partyId: string; issuedAt: unknown; dueAt?: unknown; memo?: string; lines: { description: string; quantity: number; unitPrice: unknown; discount?: unknown; tax?: unknown }[] }) {
  if (!Array.isArray(input.lines) || !input.lines.length || input.lines.length > 100) throw new Error('فاکتور باید شامل ردیف باشد');
  const lines = input.lines.map(l => {
    if (!Number.isSafeInteger(l.quantity) || l.quantity <= 0 || l.quantity > 1_000_000) throw new Error('تعداد نامعتبر است');
    const price = positive(l.unitPrice), discount = toRials(l.discount ?? 0), tax = toRials(l.tax ?? 0);
    if (discount < 0n || tax < 0n || discount >= price * BigInt(l.quantity)) throw new Error('تخفیف یا مالیات نامعتبر است');
    if (!l.description?.trim()) throw new Error('عنوان ردیف الزامی است');
    return { description: l.description.trim(), quantity: l.quantity, unitPrice: price, discount, tax };
  });
  const subtotal = lines.reduce((acc,l)=>acc + l.unitPrice * BigInt(l.quantity), 0n);
  const discount = lines.reduce((acc,l)=>acc+l.discount,0n);
  const tax = lines.reduce((acc,l)=>acc+l.tax,0n);
  const total = subtotal - discount + tax;
  if (total <= 0n) throw new Error('مبلغ نهایی فاکتور باید مثبت باشد');
  return prisma.$transaction(async tx => {
    const party = await tx.party.findFirst({ where: { id: input.partyId, orgId: input.orgId } });
    if (!party) throw new Error('طرف حساب یافت نشد');
    if (input.kind === 'SALE' && party.kind === 'SUPPLIER') throw new Error('این طرف حساب مشتری نیست');
    if (input.kind === 'PURCHASE' && party.kind === 'CUSTOMER') throw new Error('این طرف حساب تأمین‌کننده نیست');
    const issuedAt = toIsoDate(input.issuedAt);
    const dueAt = input.dueAt ? toIsoDate(input.dueAt) : null;
    const invoice = await tx.invoice.create({ data: { orgId: input.orgId, partyId: input.partyId, kind: input.kind, issuedAt, dueAt, memo: input.memo, total, subtotal, tax, discount, lines: { create: lines } } });
    await audit(tx, input.orgId, input.actorId, 'CREATE', 'Invoice', invoice.id, undefined, { total: total.toString() });
    return invoice;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
export async function updateDraftInvoice(input: { orgId:string; actorId:string; id:string; kind:InvoiceKind; partyId:string; issuedAt:unknown; dueAt?:unknown; memo?:string; lines:{description:string;quantity:number;unitPrice:unknown;discount?:unknown;tax?:unknown}[] }){
  if(!Array.isArray(input.lines)||input.lines.length<1||input.lines.length>100)throw new Error('ردیف‌های فاکتور نامعتبر است');
  const normalized=input.lines.map(l=>{
    if(!Number.isSafeInteger(l.quantity)||l.quantity<1)throw new Error('تعداد نامعتبر است');
    const unitPrice=positive(l.unitPrice),discount=toRials(l.discount??0),tax=toRials(l.tax??0);
    if(!String(l.description||'').trim()||discount<0n||tax<0n||discount>=unitPrice*BigInt(l.quantity))throw new Error('اقلام فاکتور نامعتبرند');
    return {description:l.description,quantity:l.quantity,unitPrice,discount,tax};
  });
  const subtotal=normalized.reduce((a,l)=>a+l.unitPrice*BigInt(l.quantity),0n);
  const discount=normalized.reduce((a,l)=>a+l.discount,0n);
  const tax=normalized.reduce((a,l)=>a+l.tax,0n);
  const total=subtotal-discount+tax;
  if(total<=0n)throw new Error('مبلغ کل باید مثبت باشد');
  return prisma.$transaction(async tx=>{
    const inv=await tx.invoice.findFirst({where:{id:input.id,orgId:input.orgId}});
    if(!inv||inv.status!=='DRAFT')throw new Error('فقط فاکتور پیش‌نویس قابل ویرایش است');
    const party=await tx.party.findFirst({where:{id:input.partyId,orgId:input.orgId}});
    if(!party)throw new Error('طرف حساب نامعتبر است');
    if(input.kind==='SALE'&&party.kind==='SUPPLIER'||input.kind==='PURCHASE'&&party.kind==='CUSTOMER')throw new Error('نوع طرف حساب با فاکتور سازگار نیست');
    await tx.invoiceLine.deleteMany({where:{invoiceId:inv.id}});
    const invoice=await tx.invoice.update({where:{id:inv.id},data:{partyId:input.partyId,kind:input.kind,issuedAt:toIsoDate(input.issuedAt),dueAt:input.dueAt?toIsoDate(input.dueAt):null,memo:input.memo??null,subtotal,discount,tax,total,lines:{create:normalized}}});
    await audit(tx,input.orgId,input.actorId,'UPDATE','Invoice',inv.id,undefined,{total:total.toString()});
    return invoice;
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}
async function mappedAccounts(tx: Tx, orgId: string, codes: string[]) {
  const accounts = await tx.account.findMany({ where: { orgId, code: { in: codes }, isActive: true } });
  const map = new Map(accounts.map(a=>[a.code,a]));
  for(const code of codes) if(!map.has(code)) throw new Error(`سرفصل پیش‌فرض ${code} حذف یا غیرفعال شده است`);
  return map;
}
export async function issueInvoice(orgId: string, actorId: string, id: string) {
  return prisma.$transaction(async tx => {
    const invoice = await tx.invoice.findFirst({ where: { id, orgId }, include: { lines: true } });
    if (!invoice) throw new Error('فاکتور یافت نشد');
    if (invoice.status !== 'DRAFT') throw new Error('فاکتور قبلاً نهایی شده است');
    const subtotal = invoice.lines.reduce((a,l)=>a + l.unitPrice * BigInt(l.quantity), 0n);
    const discounts = invoice.lines.reduce((a,l)=>a + l.discount,0n);
    const taxes = invoice.lines.reduce((a,l)=>a + l.tax,0n);
    if (subtotal-discounts+taxes !== invoice.total || invoice.total <= 0n) throw new Error('مجموع فاکتور با ردیف‌ها تطابق ندارد');
    const codes = invoice.kind === 'SALE' ? ['1200','4100','2200'] : ['2100','5100','1300'];
    const acc = await mappedAccounts(tx, orgId, codes);
    let lines: LineInput[];
    if (invoice.kind === 'SALE') lines = [
      {accountId:acc.get('1200')!.id,debit:invoice.total,credit:0n},
      {accountId:acc.get('4100')!.id,debit:0n,credit:invoice.subtotal-invoice.discount},
      ...(invoice.tax>0n?[{accountId:acc.get('2200')!.id,debit:0n,credit:invoice.tax}]:[])
    ];
    else lines = [
      {accountId:acc.get('5100')!.id,debit:invoice.subtotal-invoice.discount,credit:0n},
      ...(invoice.tax>0n?[{accountId:acc.get('1300')!.id,debit:invoice.tax,credit:0n}]:[]),
      {accountId:acc.get('2100')!.id,debit:0n,credit:invoice.total}
    ];
    const journal = await createPostedJournal(tx, {orgId,actorId,bookedAt:invoice.issuedAt,memo:`فاکتور ${invoice.kind === 'SALE'?'فروش':'خرید'} ${id}`,source:'INVOICE',sourceId:id,lines});
    const number = await nextNumber(tx, orgId, invoice.kind==='SALE'?'SI':'PI');
    await tx.invoice.update({where:{id},data:{status:'ISSUED',number,journalId:journal.id}});
    await audit(tx,orgId,actorId,'ISSUE','Invoice',id,undefined,{number,journalId:journal.id});
    return { id, number, journalId: journal.id };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
export async function addMovement(input: { orgId:string; actorId:string; kind:'RECEIPT'|'PAYMENT'|'TRANSFER'; amount:unknown; occurredAt:unknown; sourceId?:string; destinationId?:string; partyId?:string; invoiceId?:string; categoryAccountId?:string; memo?:string; reference?:string }) {
  const amount=positive(input.amount), occurredAt=toIsoDate(input.occurredAt);
  return prisma.$transaction(async tx=>{
    if(input.partyId && !await tx.party.count({where:{id:input.partyId,orgId:input.orgId}}))throw new Error('طرف حساب متعلق به این شرکت نیست');
    if(input.invoiceId && !await tx.invoice.count({where:{id:input.invoiceId,orgId:input.orgId}}))throw new Error('فاکتور متعلق به این شرکت نیست');
    const targetIds=[input.sourceId,input.destinationId].filter((x):x is string=>!!x);
    if(targetIds.length && await tx.treasuryAccount.count({where:{orgId:input.orgId,id:{in:targetIds}}})!==new Set(targetIds).size)throw new Error('حساب خزانه متعلق به این شرکت نیست');
    const movement=await tx.treasuryMovement.create({data:{orgId:input.orgId,kind:input.kind,amount,occurredAt,sourceId:input.sourceId||null,destinationId:input.destinationId||null,partyId:input.partyId||null,invoiceId:input.invoiceId||null,categoryAccountId:input.categoryAccountId||null,memo:input.memo,reference:input.reference}});
    await audit(tx,input.orgId,input.actorId,'CREATE','TreasuryMovement',movement.id);
    return movement;
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}
export async function postMovement(orgId:string,actorId:string,id:string){
  return prisma.$transaction(async tx=>{
    const m=await tx.treasuryMovement.findFirst({where:{id,orgId}});
    if(!m) throw new Error('تراکنش یافت نشد');
    if(m.status!=='DRAFT') throw new Error('تراکنش قبلاً ثبت شده است');
    const accounts=await tx.treasuryAccount.findMany({where:{orgId,id:{in:[m.sourceId,m.destinationId].filter((x):x is string=>!!x)}}});
    const treasury=new Map(accounts.map(x=>[x.id,x]));
    const source=m.sourceId?treasury.get(m.sourceId):null, dest=m.destinationId?treasury.get(m.destinationId):null;
    if(m.sourceId&&!source || m.destinationId&&!dest) throw new Error('حساب خزانه متعلق به شرکت نیست');
    const codes=await mappedAccounts(tx,orgId,['1200','2100','4100','5200']);
    let debit:string,credit:string;
    if(m.kind==='TRANSFER'){
      if(!source||!dest||source.id===dest.id||m.invoiceId) throw new Error('انتقال باید بین دو حساب خزانه متفاوت باشد');
      debit=dest.accountId; credit=source.accountId;
    }else if(m.kind==='RECEIPT'){
      if(!dest||source) throw new Error('حساب مقصد دریافت نامعتبر است');
      debit=dest.accountId;credit=m.invoiceId?codes.get('1200')!.id:m.categoryAccountId||codes.get('4100')!.id;
    }else{
      if(!source||dest) throw new Error('حساب مبدأ پرداخت نامعتبر است');
      credit=source.accountId;debit=m.invoiceId?codes.get('2100')!.id:m.categoryAccountId||codes.get('5200')!.id;
    }
    if(m.categoryAccountId){
      const category=await tx.account.findFirst({where:{id:m.categoryAccountId,orgId,isActive:true}});
      if(!category) throw new Error('حساب دسته‌بندی نامعتبر است');
      if(m.kind==='RECEIPT'&&category.type!=='REVENUE' || m.kind==='PAYMENT'&&category.type!=='EXPENSE') throw new Error('ماهیت حساب دسته‌بندی با دریافت یا پرداخت سازگار نیست');
    }
    if(m.invoiceId){
      if(m.kind==='TRANSFER') throw new Error('انتقال قابل تخصیص به فاکتور نیست');
      const inv=await tx.invoice.findFirst({where:{id:m.invoiceId,orgId}});
      if(!inv||inv.status==='DRAFT'||inv.status==='VOID'||(m.kind==='RECEIPT'?inv.kind!=='SALE':inv.kind!=='PURCHASE')) throw new Error('فاکتور قابل تسویه نیست');
      if(m.partyId && m.partyId!==inv.partyId) throw new Error('طرف حساب با فاکتور مطابقت ندارد');
      if(inv.total-inv.paid<m.amount) throw new Error('مبلغ تراکنش از مانده فاکتور بیشتر است');
      const paid=inv.paid+m.amount;
      await tx.invoice.update({where:{id:inv.id},data:{paid,status:paid===inv.total?'PAID':'PARTIAL'}});
      let allocate = m.amount;
      const installments=await tx.installment.findMany({where:{orgId,invoiceId:inv.id,status:'PENDING'},orderBy:{dueAt:'asc'}});
      for(const inst of installments){
        if(allocate<=0n)break;
        const delta=allocate<(inst.amount-inst.paid)?allocate:(inst.amount-inst.paid);
        if(delta<=0n)continue;
        const paidInst=inst.paid+delta;
        await tx.installment.update({where:{id:inst.id},data:{paid:paidInst,status:paidInst===inst.amount?'PAID':'PENDING',paidAt:paidInst===inst.amount?new Date():null}});
        allocate-=delta;
      }
    } else if(m.partyId) {
      const party=await tx.party.count({where:{orgId,id:m.partyId}});
      if(!party) throw new Error('طرف حساب نامعتبر است');
    }
    const journal=await createPostedJournal(tx,{orgId,actorId,bookedAt:m.occurredAt,memo:m.memo||`تراکنش ${m.kind}`,source:'TREASURY',sourceId:id,lines:[{accountId:debit,debit:m.amount,credit:0n},{accountId:credit,debit:0n,credit:m.amount}]});
    await tx.treasuryMovement.update({where:{id},data:{journalId:journal.id,status:'POSTED'}});
    await audit(tx,orgId,actorId,'POST','TreasuryMovement',id,undefined,{journalId:journal.id});
    return {id,journalId:journal.id};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}
export async function runRecurring(orgId:string,actorId:string,id:string){
 return prisma.$transaction(async tx=>{
   const rule=await tx.recurringRule.findFirst({where:{id,orgId}});
   if(!rule)throw new Error('الگوی تکرارشونده یافت نشد');
   if(!rule.active)throw new Error('الگوی تکرار غیرفعال است');
   const date=new Date(rule.nextAt);
   if(date.getTime()>Date.now())throw new Error('موعد اجرای این الگو هنوز نرسیده است');
   const next=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+rule.intervalMonths,1));
   const monthLastDay=new Date(Date.UTC(next.getUTCFullYear(),next.getUTCMonth()+1,0)).getUTCDate();
   next.setUTCDate(Math.min(date.getUTCDate(),monthLastDay));
   const journal=await createPostedJournal(tx,{orgId,actorId,bookedAt:date,memo:`ثبت دوره‌ای: ${rule.name}`,source:'RECURRING',sourceId:id,lines:[
     {accountId:rule.debitAccountId,debit:rule.amount,credit:0n},{accountId:rule.creditAccountId,debit:0n,credit:rule.amount}
   ]});
   await tx.recurringRule.update({where:{id},data:{nextAt:next}});
   await audit(tx,orgId,actorId,'EXECUTE','RecurringRule',id,undefined,{journalId:journal.id});
   return {id,journalId:journal.id,nextAt:next};
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}
export async function closePeriod(orgId:string,actorId:string,id:string){
  return prisma.$transaction(async tx=>{
    const period=await tx.fiscalPeriod.findFirst({where:{id,orgId}});
    if(!period) throw new Error('دوره یافت نشد');
    if(period.status==='CLOSED') throw new Error('این دوره قبلاً بسته شده است');
    const draftCount=await tx.journal.count({where:{orgId,status:'DRAFT',bookedAt:{gte:period.startsAt,lte:period.endsAt}}});
    if(draftCount>0) throw new Error('ابتدا تمام اسناد پیش‌نویس دوره را ثبت یا حذف کنید');
    await tx.fiscalPeriod.update({where:{id},data:{status:'CLOSED'}});
    await audit(tx,orgId,actorId,'CLOSE','FiscalPeriod',id);
    return {id,status:'CLOSED'};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}
