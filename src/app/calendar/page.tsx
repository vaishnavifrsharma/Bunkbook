import { createClient } from '@/lib/supabase/server';
import CalendarClient from './CalendarClient';
import { fetchAttendanceData } from '@/lib/attendance-fetcher';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Calendar — BunkBook',
};

export default async function CalendarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const initialData = await fetchAttendanceData(supabase);

  return <CalendarClient initialData={initialData} />;
}
