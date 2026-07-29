// ============================================================
// Attendance Math Engine
// Core calculation functions for weighted attendance & advisories
// ============================================================

import {
  type TimetableSlot,
  type DayOverride,
  type ClassOverride,
  type AttendanceStats,
  type BunkStats,
} from './types';
import { eachDayOfInterval, getDay, parseISO, isAfter, format, min as dateMin } from 'date-fns';

/**
 * Infer weight of a slot (1 or 2):
 * - If slot.weight is explicitly set, use it.
 * - Otherwise, if start_time and end_time span >= 110 mins (e.g. 2 hours), weight = 2.
 * - Otherwise, weight = 1.
 */
export function getSlotWeight(slot: TimetableSlot): number {
  if (slot.weight && slot.weight > 0) return slot.weight;
  if (!slot.start_time || !slot.end_time) return 1;

  try {
    const [h1, m1] = slot.start_time.split(':').map(Number);
    const [h2, m2] = slot.end_time.split(':').map(Number);
    const durationMins = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (durationMins >= 110) return 2; // 2-hour lecture block = 2 units
  } catch {
    // fallback
  }
  return 1;
}

/**
 * Calculate weighted attendance stats for a single subject.
 */
export function calculateAttendance(
  subjectId: string,
  slots: TimetableSlot[],
  dayOverrides: DayOverride[],
  classOverrides: ClassOverride[],
  semesterStart: string,
  semesterEnd: string,
): AttendanceStats {
  const start = parseISO(semesterStart);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const end = dateMin([parseISO(semesterEnd), today]);

  // If semester hasn't started yet
  if (isAfter(start, end)) {
    return { totalHeld: 0, attended: 0, absent: 0, cancelled: 0, massBunkCount: 0, percentage: 100 };
  }

  // Get the subject's timetable slots (which weekdays)
  const subjectSlots = slots.filter(s => s.subject_id === subjectId);
  const slotWeekdays = new Set(subjectSlots.map(s => s.weekday));

  // Build lookup maps for fast access
  const dayOverrideMap = new Map<string, DayOverride>();
  for (const d of dayOverrides) {
    dayOverrideMap.set(d.date, d);
  }

  // Class overrides keyed by "slotId:date"
  const classOverrideMap = new Map<string, ClassOverride>();
  for (const c of classOverrides) {
    if (c.subject_id === subjectId) {
      classOverrideMap.set(`${c.slot_id}:${c.date}`, c);
    }
  }

  let totalHeld = 0;
  let attended = 0;
  let absent = 0;
  let cancelled = 0;
  let massBunkCount = 0;

  // Iterate each day from start to end
  const days = eachDayOfInterval({ start, end });

  for (const day of days) {
    const weekday = getDay(day); // 0=Sun ... 6=Sat
    if (!slotWeekdays.has(weekday)) continue;

    const dateStr = format(day, 'yyyy-MM-dd');
    const dayOverride = dayOverrideMap.get(dateStr);

    // Holiday → entire day removed from "held" count
    if (dayOverride?.type === 'holiday') continue;

    // Get slots for this weekday
    const todaySlots = subjectSlots.filter(s => s.weekday === weekday);

    for (const slot of todaySlots) {
      const classOverride = classOverrideMap.get(`${slot.id}:${dateStr}`);
      const weight = getSlotWeight(slot);

      if (classOverride?.type === 'cancelled') {
        // Cancelled class → excluded from total held
        cancelled += weight;
        continue;
      }

      // Class was held
      totalHeld += weight;

      if (dayOverride?.type === 'mass_bunk') {
        absent += weight;
        massBunkCount += weight;
      } else if (classOverride?.type === 'absent') {
        absent += weight;
      } else {
        // Default present
        attended += weight;
      }
    }
  }

  const percentage = totalHeld > 0 ? (attended / totalHeld) * 100 : 100;

  return { totalHeld, attended, absent, cancelled, massBunkCount, percentage };
}

/**
 * Calculate weighted bunk-ability (forward-looking):
 * How many future classes can be missed while staying at/above target?
 */
export function calculateBunkability(
  attended: number,
  totalHeld: number,
  subjectId: string,
  slots: TimetableSlot[],
  dayOverrides: DayOverride[],
  semesterEnd: string,
  targetPct: number,
): BunkStats {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const end = parseISO(semesterEnd);

  if (isAfter(tomorrow, end)) {
    const isImpossible = totalHeld > 0 && (attended / totalHeld) * 100 < targetPct;
    return {
      remaining: 0,
      safeMisses: 0,
      classesNeeded: 0,
      isImpossible,
      advisoryMessage: isImpossible
        ? `Target ${targetPct}% not reachable ⚠️`
        : `Semester completed!`,
    };
  }

  const subjectSlots = slots.filter(s => s.subject_id === subjectId);
  const slotWeekdays = new Set(subjectSlots.map(s => s.weekday));

  const dayOverrideMap = new Map<string, DayOverride>();
  for (const d of dayOverrides) {
    dayOverrideMap.set(d.date, d);
  }

  // Count remaining weighted scheduled slots (excluding known holidays)
  let remaining = 0;
  const futureDays = eachDayOfInterval({ start: tomorrow, end });

  for (const day of futureDays) {
    const weekday = getDay(day);
    if (!slotWeekdays.has(weekday)) continue;

    const dateStr = format(day, 'yyyy-MM-dd');
    const dayOverride = dayOverrideMap.get(dateStr);
    if (dayOverride?.type === 'holiday') continue;

    const daySlots = subjectSlots.filter(s => s.weekday === weekday);
    for (const slot of daySlots) {
      remaining += getSlotWeight(slot);
    }
  }

  const targetFraction = targetPct / 100;
  const totalAfter = totalHeld + remaining;
  const needed = Math.ceil(targetFraction * totalAfter);
  const safeMisses = Math.max(0, attended + remaining - needed);

  let classesNeeded = 0;
  const isImpossible = attended + remaining < needed;

  if (attended < Math.ceil(targetFraction * totalHeld) || safeMisses === 0) {
    classesNeeded = Math.max(0, needed - attended);
    if (classesNeeded > remaining) {
      classesNeeded = remaining;
    }
  }

  // Actionable Advisory Phrasing
  let advisoryMessage = '';
  if (isImpossible) {
    advisoryMessage = `Target ${targetPct}% not reachable ⚠️`;
  } else if (safeMisses > 0) {
    advisoryMessage = `Can miss next ${safeMisses} class${safeMisses > 1 ? 'es' : ''}`;
  } else if (classesNeeded > 0) {
    advisoryMessage = `Attend next ${classesNeeded} in a row`;
  } else {
    advisoryMessage = `On track for ${targetPct}%`;
  }

  return { remaining, safeMisses, classesNeeded, isImpossible, advisoryMessage };
}
