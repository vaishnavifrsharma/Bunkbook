import { createClient } from '@/lib/supabase/server';
import SubjectClient from './SubjectClient';
import { fetchAttendanceData } from '@/lib/attendance-fetcher';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  // We can fetch the subject name here, or just return a generic title
  return { title: 'Subject Details — BunkBook' };
}

export default async function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const initialData = await fetchAttendanceData(supabase);

  return <SubjectClient subjectId={resolvedParams.id} initialData={initialData} />;
}
