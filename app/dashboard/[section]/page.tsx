import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { AdminApp } from '@/components/admin-app';
export default async function Page({params}:{params:Promise<{section:string}>}) {
 const user=await currentUser();if(!user)redirect('/');
 const {section}=await params;
 return <AdminApp section={section} user={user}/>;
}
