import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { AuthPanel } from '@/components/auth-panel';
export default async function Home(){
  if(process.env.PUBLIC_DEMO_MODE !== '0')redirect('/dashboard/overview');
  if(await currentUser())redirect('/dashboard/overview');
  return <AuthPanel/>;
}
