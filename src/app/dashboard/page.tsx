import { createClient } from '@/lib/supabase/server';
import DashboardClient from './DashboardClient';
import { fetchAttendanceData } from '@/lib/attendance-fetcher';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dashboard — BunkBook',
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const initialData = await fetchAttendanceData(supabase);

  return <DashboardClient initialData={initialData} />;
}
