'use client';

import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import { fetchAttendanceData, AttendanceData } from './attendance-fetcher';

export type { AttendanceData };

export function useAttendanceData(fallbackData?: AttendanceData) {
  const supabase = createClient();
  return useSWR<AttendanceData>('attendance-data', () => fetchAttendanceData(supabase), {
    fallbackData,
    revalidateOnFocus: true,
  });
}
