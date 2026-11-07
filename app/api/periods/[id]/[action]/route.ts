import { NextRequest } from 'next/server';
import { requireMember,ADMIN_ROLES } from '@/lib/auth';
import { apiError,json,ok } from '@/lib/validation';
import { closePeriod } from '@/lib/ledger';
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string;action:string}>}){
 try{const {id,action}=await params,b=await json(request),orgId=String(b.orgId||'');const {user}=await requireMember(orgId,ADMIN_ROLES);if(action!=='close')throw new Error('عملیات نامعتبر است');return ok(await closePeriod(orgId,user.id,id));}catch(e){return apiError(e)}
}
