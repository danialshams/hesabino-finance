import { NextRequest } from 'next/server';
import { requireMember, WRITE_ROLES } from '@/lib/auth';
import { apiError,json,ok } from '@/lib/validation';
import { asJson } from '@/lib/money';
import { postJournal,reverseJournal,saveDraftJournal } from '@/lib/ledger';
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string;action:string}>}){
 try{
  const {id,action}=await params,b=await json(request),orgId=String(b.orgId||'');
  const {user}=await requireMember(orgId,WRITE_ROLES);
  const result=action==='post'?await postJournal(orgId,user.id,id):action==='reverse'?await reverseJournal(orgId,user.id,id):action==='save'?await saveDraftJournal({orgId,actorId:user.id,id,bookedAt:b.bookedAt,memo:b.memo,lines:b.lines}):null;
  if(!result)throw new Error('عملیات نامعتبر است');
  return ok(asJson(result));
 }catch(e){return apiError(e)}
}
