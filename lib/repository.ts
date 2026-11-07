import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { requireMember, WRITE_ROLES, ADMIN_ROLES } from './auth';
import { positive, toIsoDate, toRials, asJson } from './money';
import { saveDraftJournal, addInvoice, addMovement } from './ledger';
import { dashboardData, financialReport } from './reports';

const tableNames = ['accounts','journals','parties','invoices','treasury','movements','budgets','periods','centers','projects','recurring','installments','statements','members','audit','branches'] as const;
export type Resource = typeof tableNames[number] | 'dashboard' | 'reports' | 'organizations';
export async function readResource(resource:string,orgId:string,params:URLSearchParams){
 const user=await requireMember(orgId);
 const take=100;
 switch(resource){
  case 'accounts': return prisma.account.findMany({where:{orgId},orderBy:{code:'asc'},take});
  case 'journals': return prisma.journal.findMany({where:{orgId},include:{lines:{include:{account:{select:{code:true,name:true}}}}},orderBy:{createdAt:'desc'},take});
  case 'parties': return prisma.party.findMany({where:{orgId},orderBy:{createdAt:'desc'},take});
  case 'invoices': return prisma.invoice.findMany({where:{orgId},include:{party:{select:{name:true}},lines:true},orderBy:{createdAt:'desc'},take});
  case 'treasury':return prisma.treasuryAccount.findMany({where:{orgId},include:{account:{select:{name:true,code:true}}},take});
  case 'movements':return prisma.treasuryMovement.findMany({where:{orgId},orderBy:{createdAt:'desc'},take});
  case 'budgets':return prisma.budget.findMany({where:{orgId},include:{account:{select:{code:true,name:true}}},take});
  case 'periods':return prisma.fiscalPeriod.findMany({where:{orgId},orderBy:{startsAt:'desc'},take});
  case 'centers':return prisma.costCenter.findMany({where:{orgId},take});
  case 'projects':return prisma.financialProject.findMany({where:{orgId},take});
  case 'recurring':return prisma.recurringRule.findMany({where:{orgId},take});
  case 'installments':return prisma.installment.findMany({where:{orgId},include:{invoice:{select:{number:true,party:{select:{name:true}}}}},take});
  case 'statements':return prisma.bankStatementLine.findMany({where:{orgId},orderBy:{occurredAt:'desc'},take});
  case 'members':return prisma.membership.findMany({where:{orgId},include:{user:{select:{name:true,email:true}}},take});
  case 'audit':await requireMember(orgId,['OWNER','ADMIN','ACCOUNTANT','FINANCE_MANAGER']);return prisma.auditLog.findMany({where:{orgId},orderBy:{occurredAt:'desc'},take});
  case 'branches':return prisma.branch.findMany({where:{orgId},take});
  case 'dashboard':return dashboardData(orgId);
  case 'reports':return financialReport(orgId,params.get('type')||'trial',params.get('from'),params.get('to'),params.get('accountId'));
  default:throw new Error('بخش موردنظر یافت نشد');
 }
}
export async function createResource(resource:string,orgId:string,body:Record<string,any>){
 const {user}=await requireMember(orgId,WRITE_ROLES);
 const action=await (async()=>{
 switch(resource){
  case 'accounts': {
   if(!/^\d{2,12}$/.test(String(body.code))||!String(body.name||'').trim()||!['ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE'].includes(body.type))throw new Error('کد، نام یا ماهیت حساب نامعتبر است');
   if(body.parentId){const parent=await prisma.account.findFirst({where:{orgId,id:body.parentId}});if(!parent||parent.type!==body.type)throw new Error('حساب والد نامعتبر است');}
   return prisma.account.create({data:{orgId,code:String(body.code),name:String(body.name),type:body.type,parentId:body.parentId||null}});
  }
  case 'journals':return saveDraftJournal({orgId,actorId:user.id,bookedAt:body.bookedAt,memo:String(body.memo||'سند بدون شرح'),lines:body.lines});
  case 'parties':{
    if(!String(body.name||'').trim())throw new Error('نام طرف حساب الزامی است');
    return prisma.party.create({data:{orgId,name:String(body.name).trim(),kind:body.kind||'BOTH',phone:body.phone||null,email:body.email||null,address:body.address||null}});
  }
  case 'invoices':return addInvoice({orgId,actorId:user.id,kind:body.kind,partyId:body.partyId,issuedAt:body.issuedAt,dueAt:body.dueAt,memo:body.memo,lines:body.lines});
  case 'treasury': {
    if(!body.name||!['BANK','CASH'].includes(body.kind))throw new Error('نام یا نوع حساب خزانه نامعتبر است');
    const account=await prisma.account.findFirst({where:{orgId,id:body.accountId,type:'ASSET',isActive:true}});if(!account)throw new Error('حساب معین خزانه نامعتبر است');
    if(await prisma.treasuryAccount.count({where:{orgId,accountId:account.id}})>0)throw new Error('این حساب معین قبلاً به خزانه دیگری متصل شده است');
    return prisma.treasuryAccount.create({data:{orgId,name:body.name,kind:body.kind,accountId:body.accountId,bankName:body.bankName||null,iban:body.iban||null}});
  }
  case 'movements':return addMovement({orgId,actorId:user.id,kind:body.kind,amount:body.amount,occurredAt:body.occurredAt,sourceId:body.sourceId,destinationId:body.destinationId,invoiceId:body.invoiceId,partyId:body.partyId,categoryAccountId:body.categoryAccountId,reference:body.reference,memo:body.memo});
  case 'budgets':{
    const account=await prisma.account.findFirst({where:{id:body.accountId,orgId,type:'EXPENSE'}});if(!account)throw new Error('بودجه باید به یک حساب هزینه معتبر متصل شود');
    if(body.centerId&&!await prisma.costCenter.count({where:{id:body.centerId,orgId}}))throw new Error('مرکز هزینه نامعتبر');
    const startsAt=toIsoDate(body.startsAt),endsAt=toIsoDate(body.endsAt);if(startsAt>endsAt)throw new Error('بازه نامعتبر');
    return prisma.budget.create({data:{orgId,name:body.name||'بودجه',accountId:body.accountId,centerId:body.centerId||null,startsAt,endsAt,limit:positive(body.limit)}});
  }
  case 'periods': {
    await requireMember(orgId,ADMIN_ROLES);
    const startsAt=toIsoDate(body.startsAt),endsAt=toIsoDate(body.endsAt);if(startsAt>endsAt)throw new Error('بازه نامعتبر');
    const overlap=await prisma.fiscalPeriod.count({where:{orgId,AND:[{startsAt:{lte:endsAt}},{endsAt:{gte:startsAt}}]}});
    if(overlap)throw new Error('دوره جدید با دوره موجود هم‌پوشانی دارد');
    return prisma.fiscalPeriod.create({data:{orgId,name:String(body.name||'دوره مالی'),startsAt,endsAt}});
  }
  case 'centers':return prisma.costCenter.create({data:{orgId,name:String(body.name||'مرکز هزینه')}});
  case 'projects':return prisma.financialProject.create({data:{orgId,name:String(body.name||'پروژه'),code:body.code||null}});
  case 'branches':await requireMember(orgId,ADMIN_ROLES);return prisma.branch.create({data:{orgId,name:String(body.name||'شعبه'),address:body.address||null}});
  case 'recurring':{
    const debit=await prisma.account.findFirst({where:{orgId,id:body.debitAccountId}});const credit=await prisma.account.findFirst({where:{orgId,id:body.creditAccountId}});
    if(!debit||!credit||debit.id===credit.id)throw new Error('حساب‌های الگوی تکرارشونده نامعتبرند');
    const months=Number(body.intervalMonths||1);if(!Number.isInteger(months)||months<1||months>36)throw new Error('فاصله تکرار باید بین یک تا ۳۶ ماه باشد');
    return prisma.recurringRule.create({data:{orgId,name:body.name,amount:positive(body.amount),debitAccountId:debit.id,creditAccountId:credit.id,nextAt:toIsoDate(body.nextAt),intervalMonths:months}});
  }
  case 'installments':{
    const invoice=await prisma.invoice.findFirst({where:{id:body.invoiceId,orgId}});if(!invoice||invoice.status==='DRAFT'||invoice.status==='VOID')throw new Error('فاکتور صادرشده معتبر انتخاب کنید');
    const amount=positive(body.amount);const other=await prisma.installment.aggregate({where:{invoiceId:invoice.id},_sum:{amount:true}});
    if(amount+(other._sum.amount??0n)>invoice.total)throw new Error('جمع اقساط از مبلغ فاکتور بیشتر می‌شود');
    return prisma.installment.create({data:{orgId,invoiceId:invoice.id,amount,dueAt:toIsoDate(body.dueAt)}});
  }
  case 'members':{
    await requireMember(orgId,ADMIN_ROLES);
    const email=String(body.email||'').trim().toLowerCase();
    const target=await prisma.user.findUnique({where:{email}});
    if(!target)throw new Error('کاربر ابتدا باید در حسابینو ثبت‌نام کند');
    if(!['ADMIN','ACCOUNTANT','FINANCE_MANAGER','VIEWER'].includes(body.role))throw new Error('نقش نامعتبر است');
    return prisma.membership.create({data:{orgId,userId:target.id,role:body.role}});
  }
  case 'statements':{
    const treasury=await prisma.treasuryAccount.findFirst({where:{id:body.treasuryId,orgId}});if(!treasury)throw new Error('حساب خزانه نامعتبر است');
    const amount=toRials(body.amount);if(amount===0n)throw new Error('مبلغ صورت‌حساب نمی‌تواند صفر باشد');
    return prisma.bankStatementLine.create({data:{orgId,treasuryId:body.treasuryId,occurredAt:toIsoDate(body.occurredAt),amount,reference:body.reference||null}});
  }
  default:throw new Error('امکان ایجاد در این بخش پشتیبانی نمی‌شود');
 }
 })();
 await prisma.auditLog.create({data:{orgId,actorId:user.id,action:'CREATE',entity:resource,entityId:action.id||'',after:{resource}}});
 return action;
}
