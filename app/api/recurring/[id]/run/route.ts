import { NextRequest } from 'next/server';
import { requireMember,WRITE_ROLES } from '@/lib/auth';
import { apiError,json,ok } from '@/lib/validation';
import { asJson } from '@/lib/money';
import { runRecurring } from '@/lib/ledger';
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{const {id}=await params,b=await json(request),orgId=String(b.orgId||'');const {user}=await requireMember(orgId,WRITE_ROLES);return ok(asJson(await runRecurring(orgId,user.id,id)));}catch(e){return apiError(e)}
}
