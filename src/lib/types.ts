// ============================================================
// TypeScript types for the Attendance & Bunk Calculator app
// ============================================================

export type SubjectType = 'lecture' | 'lab' | 'tutorial';
export type OverrideType = 'absent' | 'cancelled';
export type DayOverrideType = 'holiday' | 'mass_bunk';

// ---- Database row types ----

export interface Semester {
  id: string;
  user_id: string;
  name: string;
  start_date: string; // ISO date string
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: string;
  user_id: string;
  semester_id: string;
  name: string;
  type: SubjectType;
  target_pct: number;
  condonation_pct: number;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface TimetableSlot {
  id: string;
  user_id: string;
  subject_id: string;
  semester_id: string;
  weekday: number; // 0=Sun, 1=Mon, ..., 6=Sat
  start_time: string; // "HH:MM:SS"
  end_time: string | null;
  weight?: number; // 1 or 2 (default 1)
  created_at: string;
}

export interface DayOverride {
  id: string;
  user_id: string;
  semester_id: string;
  date: string;
  type: DayOverrideType;
  label: string | null;
  created_at: string;
}

export interface ClassOverride {
  id: string;
  user_id: string;
  subject_id: string;
  slot_id: string;
  date: string;
  type: OverrideType;
  note: string | null;
  created_at: string;
}

// ---- Computed types ----

export interface AttendanceStats {
  totalHeld: number;
  attended: number;
  absent: number;
  cancelled: number;
  massBunkCount: number;
  percentage: number;
}

export interface BunkStats {
  remaining: number;
  safeMisses: number;
  classesNeeded: number;
  isImpossible: boolean;
  advisoryMessage?: string;
}

export interface SubjectWithStats extends Subject {
  stats: AttendanceStats;
  bunk: BunkStats;
  slots: TimetableSlot[];
}

// ---- Sharing Template Types ----

export interface TemplateSubject {
  name: string;
  type: SubjectType;
  color: string;
  target_pct: number;
  condonation_pct: number;
}

export interface TemplateSlot {
  subjectName: string;
  weekday: number;
  start_time: string;
  end_time: string | null;
  weight?: number;
}

export interface TimetableTemplate {
  version: string;
  title: string;
  subjects: TemplateSubject[];
  slots: TemplateSlot[];
}

// ---- Calendar types ----

export type ClassStatus = 'present' | 'absent' | 'cancelled';
export type DayStatus = 'normal' | 'holiday' | 'mass_bunk';

export interface CalendarClass {
  slot: TimetableSlot;
  subject: Subject;
  status: ClassStatus;
  overrideId?: string;
}

export interface CalendarDay {
  date: string;
  dayStatus: DayStatus;
  dayOverride?: DayOverride;
  classes: CalendarClass[];
  isToday: boolean;
  isInSemester: boolean;
  isFuture: boolean;
}

// ---- Form types ----

export interface SemesterFormData {
  name: string;
  start_date: string;
  end_date: string;
}

export interface SubjectFormData {
  name: string;
  type: SubjectType;
  target_pct: number;
  condonation_pct: number;
  color: string;
}

export interface SlotFormData {
  subject_id: string;
  weekday: number;
  start_time: string;
  end_time?: string;
  weight?: number;
}

// ---- Weekday helpers ----

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const SUBJECT_COLORS = [
  '#6366f1', // indigo
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ef4444', // red
  '#14b8a6', // teal
  '#f97316', // orange
  '#06b6d4', // cyan
] as const;
