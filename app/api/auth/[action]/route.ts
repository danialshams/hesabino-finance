import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser, endSession, hashPassword, startSession, verifyPassword } from '@/lib/auth';
import { json, ok, apiError } from '@/lib/validation';
import { provisionOrganization } from '@/lib/accounts';

export async function GET(_request:NextRequest,{params}:{params:Promise<{action:string}>}){
 try{if((await params).action!=='me')throw new Error('مسیر نامعتبر');return ok({user:await currentUser()});}catch(e){return apiError(e)}
}
export async function POST(request:NextRequest,{params}:{params:Promise<{action:string}>}){
 try{
  const {action}=await params;
  if(action==='logout'){await json(request);await endSession();return ok({success:true})}
  const body=await json(request);
  const email=String(body.email||'').trim().toLowerCase(),password=String(body.password||'');
  if(!/^\S+@\S+\.\S+$/.test(email))throw new Error('ایمیل معتبر وارد کنید');
  if(action==='register'){
   const name=String(body.name||'').trim();if(name.length<2||name.length>120)throw new Error('نام باید بین ۲ تا ۱۲۰ حرف باشد');
   const count=await prisma.user.count({where:{email}});if(count)throw new Error('ایمیل قبلاً ثبت شده است');
   const passwordHash=hashPassword(password);
   const user=await prisma.user.create({data:{name,email,passwordHash}});
   try{await provisionOrganization(user.id,`کسب‌وکار ${name}`)}catch(e){await prisma.user.delete({where:{id:user.id}});throw e}
   await startSession(user.id);return ok({user:{id:user.id,name,email}},201);
  }
  if(action==='login'){
   const user=await prisma.user.findUnique({where:{email}});
   if(!user||!verifyPassword(password,user.passwordHash))throw new Error('ایمیل یا رمز عبور اشتباه است');
   await startSession(user.id);return ok({user:{id:user.id,name:user.name,email}});
  }
  throw new Error('مسیر نامعتبر');
 }catch(e){return apiError(e)}
}
