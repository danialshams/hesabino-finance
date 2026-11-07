import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { AdminApp } from '@/components/admin-app';
export default async function Page({params}:{params:Promise<{section:string}>}) {
  const {section}=await params;
  const demoMode=process.env.PUBLIC_DEMO_MODE !== '0';
  if(demoMode)return <AdminApp section={section} demoMode user={{id:'visitor',name:'بازدیدکننده دمو',email:'demo@example.com'}}/>;
  const user=await currentUser();
  if(!user)redirect('/');
  return <AdminApp section={section} user={user}/>;
}
