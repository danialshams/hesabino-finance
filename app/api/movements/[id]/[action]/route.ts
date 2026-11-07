import { NextRequest } from 'next/server';
import { requireMember,WRITE_ROLES } from '@/lib/auth';
import { apiError,json,ok } from '@/lib/validation';
import { postMovement } from '@/lib/ledger';
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string;action:string}>}){
 try{const {id,action}=await params,b=await json(request),orgId=String(b.orgId||'');const {user}=await requireMember(orgId,WRITE_ROLES);if(action!=='post')throw new Error('عملیات نامعتبر است');return ok(await postMovement(orgId,user.id,id));}catch(e){return apiError(e)}
}
