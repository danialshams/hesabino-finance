import { NextRequest } from 'next/server';
import { currentUser, requireUser, requireMember, ADMIN_ROLES, WRITE_ROLES } from '@/lib/auth';
import { apiError, json, ok } from '@/lib/validation';
import { asJson, toIsoDate } from '@/lib/money';
import { prisma } from '@/lib/prisma';
import { provisionOrganization } from '@/lib/accounts';
import { updateDraftInvoice } from '@/lib/ledger';
import { createResource, readResource } from '@/lib/repository';

export async function GET(request:NextRequest,{params}:{params:Promise<{resource:string}>}){
 try{
  const {resource}=await params;
  if(resource==='organizations'){
   const user=await requireUser();return ok(await prisma.membership.findMany({where:{userId:user.id},include:{org:true}}));
  }
  const orgId=request.nextUrl.searchParams.get('orgId');if(!orgId)throw new Error('شرکت را انتخاب کنید');
  const data=await readResource(resource,orgId,request.nextUrl.searchParams);
  return ok(asJson(data));
 }catch(e){return apiError(e)}
}
export async function POST(request:NextRequest,{params}:{params:Promise<{resource:string}>}){
 try{
  const {resource}=await params, body=await json(request);
  if(resource==='organizations'){
   const user=await requireUser();return ok(await provisionOrganization(user.id,String(body.name||'')),201);
  }
  const orgId=String(body.orgId||'');if(!orgId)throw new Error('شرکت را انتخاب کنید');
  return ok(asJson(await createResource(resource,orgId,body)),201);
 }catch(e){return apiError(e)}
}
export async function PATCH(request:NextRequest,{params}:{params:Promise<{resource:string}>}){
 try{
  const {resource}=await params, b=await json(request);
  const orgId=String(b.orgId||''),id=String(b.id||'');if(!orgId||!id)throw new Error('شرکت یا شناسه نامعتبر است');
  const {user}=await requireMember(orgId,WRITE_ROLES);
  let result:unknown;
  if(resource==='parties'){
   const row=await prisma.party.findFirst({where:{id,orgId}});if(!row)throw new Error('طرف حساب یافت نشد');
   result=await prisma.party.update({where:{id},data:{name:String(b.name||row.name),phone:b.phone??row.phone,email:b.email??row.email,address:b.address??row.address}});
  }else if(resource==='accounts'){
   const row=await prisma.account.findFirst({where:{id,orgId}});if(!row)throw new Error('حساب یافت نشد');
   result=await prisma.account.update({where:{id},data:{name:String(b.name||row.name),isActive:typeof b.isActive==='boolean'?b.isActive:row.isActive}});
  }else if(resource==='budgets'){
   const row=await prisma.budget.findFirst({where:{id,orgId}});if(!row)throw new Error('بودجه یافت نشد');
   result=await prisma.budget.update({where:{id},data:{name:b.name??row.name,limit:b.limit!==undefined?BigInt(b.limit):row.limit}});
  }else if(resource==='members'){
   await requireMember(orgId,ADMIN_ROLES);
   const row=await prisma.membership.findFirst({where:{id,orgId}});if(!row)throw new Error('عضو یافت نشد');
   if(row.role==='OWNER')throw new Error('نقش مالک غیرقابل تغییر است');
   if(!['ADMIN','ACCOUNTANT','FINANCE_MANAGER','VIEWER'].includes(b.role))throw new Error('نقش نامعتبر است');
   result=await prisma.membership.update({where:{id},data:{role:b.role}});
  }else if(resource==='invoices'){
   result=await updateDraftInvoice({orgId,actorId:user.id,id,kind:b.kind,partyId:b.partyId,issuedAt:b.issuedAt,dueAt:b.dueAt,memo:b.memo,lines:b.lines});
  }else if(resource==='recurring'){
   const row=await prisma.recurringRule.findFirst({where:{id,orgId}});if(!row)throw new Error('الگوی تکرارشونده یافت نشد');
   result=await prisma.recurringRule.update({where:{id},data:{active:typeof b.active==='boolean'?b.active:row.active}});
  }else if(resource==='statements'){
   const item=await prisma.bankStatementLine.findFirst({where:{id,orgId}});if(!item)throw new Error('تراکنش صورت‌حساب یافت نشد');
   if(item.status==='MATCHED')throw new Error('ردیف قبلاً تطبیق داده شده است');
   const movement=await prisma.treasuryMovement.findFirst({where:{id:b.movementId,orgId,status:'POSTED'}});
   if(!movement||!(movement.sourceId===item.treasuryId||movement.destinationId===item.treasuryId))throw new Error('تراکنش تطبیقی متعلق به این حساب نیست');
   const signed=movement.kind==='RECEIPT'||(movement.kind==='TRANSFER'&&movement.destinationId===item.treasuryId)?movement.amount:-movement.amount;
   if(signed!==item.amount)throw new Error('مبلغ دو تراکنش برای مغایرت‌گیری یکسان نیست');
   if(await prisma.bankStatementLine.count({where:{orgId,movementId:movement.id,status:'MATCHED'}}))throw new Error('این تراکنش قبلاً با صورت‌حساب تطبیق داده شده است');
   result=await prisma.bankStatementLine.update({where:{id},data:{status:'MATCHED',movementId:movement.id}});
  }else throw new Error('ویرایش این بخش پشتیبانی نمی‌شود');
  await prisma.auditLog.create({data:{orgId,actorId:user.id,action:'UPDATE',entity:resource,entityId:id}});
  return ok(asJson(result));
 }catch(e){return apiError(e)}
}
export async function DELETE(request:NextRequest,{params}:{params:Promise<{resource:string}>}){
 try{
  const {resource}=await params,b=await json(request);
  const orgId=String(b.orgId||''),id=String(b.id||'');if(!orgId||!id)throw new Error('شرکت یا شناسه نامعتبر است');
  const {user}=await requireMember(orgId,WRITE_ROLES);
  if(resource==='journals'){
   const j=await prisma.journal.findFirst({where:{orgId,id}});if(!j)throw new Error('سند یافت نشد');
   if(j.status!=='DRAFT')throw new Error('سند ثبت‌شده قابل حذف نیست');
   await prisma.journal.delete({where:{id}});
  }else if(resource==='invoices'){
   const i=await prisma.invoice.findFirst({where:{orgId,id}});if(!i)throw new Error('فاکتور یافت نشد');
   if(i.status!=='DRAFT')throw new Error('فاکتور صادرشده قابل حذف نیست');
   await prisma.invoice.delete({where:{id}});
  }else if(resource==='budgets'){
   const n=await prisma.budget.deleteMany({where:{orgId,id}});if(!n.count)throw new Error('بودجه یافت نشد');
  }else if(resource==='recurring'){
   const n=await prisma.recurringRule.deleteMany({where:{orgId,id}});if(!n.count)throw new Error('الگو یافت نشد');
  }else throw new Error('حذف این بخش مجاز نیست');
  await prisma.auditLog.create({data:{orgId,actorId:user.id,action:'DELETE',entity:resource,entityId:id}});
  return ok({success:true});
 }catch(e){return apiError(e)}
}
