import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { AuthPanel } from '@/components/auth-panel';
export default async function Home(){if(await currentUser())redirect('/dashboard/overview');return <AuthPanel/>}
