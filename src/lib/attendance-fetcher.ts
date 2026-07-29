import { Semester, Subject, TimetableSlot, DayOverride, ClassOverride } from './types';

export interface AttendanceData {
  semester: Semester | null;
  subjects: Subject[];
  slots: TimetableSlot[];
  dayOverrides: DayOverride[];
  classOverrides: ClassOverride[];
}

export const fetchAttendanceData = async (supabaseClient: any): Promise<AttendanceData> => {
  const { data: semesters } = await supabaseClient.from('semesters').select('*').eq('is_active', true).limit(1);
  const activeSemester = semesters?.[0] || null;
  
  if (!activeSemester) {
    return { semester: null, subjects: [], slots: [], dayOverrides: [], classOverrides: [] };
  }

  const [subjectsRes, slotsRes, dayOverridesRes] = await Promise.all([
    supabaseClient.from('subjects').select('*').eq('semester_id', activeSemester.id).order('name'),
    supabaseClient.from('timetable_slots').select('*').eq('semester_id', activeSemester.id),
    supabaseClient.from('day_overrides').select('*').eq('semester_id', activeSemester.id)
  ]);

  let classOverridesData: ClassOverride[] = [];
  if (subjectsRes.data && subjectsRes.data.length > 0) {
    const subjectIds = subjectsRes.data.map((s: Subject) => s.id);
    const { data } = await supabaseClient.from('class_overrides').select('*').in('subject_id', subjectIds);
    classOverridesData = data || [];
  }

  return {
    semester: activeSemester,
    subjects: subjectsRes.data || [],
    slots: slotsRes.data || [],
    dayOverrides: dayOverridesRes.data || [],
    classOverrides: classOverridesData,
  };
};
