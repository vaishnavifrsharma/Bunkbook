import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateAttendance, calculateBunkability } from '../src/lib/attendance';
import { TimetableSlot, DayOverride, ClassOverride } from '../src/lib/types';

describe('Attendance Calculations', () => {
  beforeEach(() => {
    // Mock the current date to a fixed point in time: Oct 15, 2026
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const baseSemesterStart = '2026-10-01'; // Thursday
  const baseSemesterEnd = '2026-10-31';

  const defaultSlot: TimetableSlot = {
    id: 'slot-1',
    user_id: 'user',
    subject_id: 'subj-1',
    semester_id: 'sem-1',
    weekday: 1, // Monday
    start_time: '09:00',
    end_time: '10:00',
    weight: 1,
    created_at: '',
  };

  describe('calculateAttendance', () => {
    it('calculates 100% when all past classes are unattended explicitly (default to present)', () => {
      const stats = calculateAttendance(
        'subj-1',
        [defaultSlot], // Every Monday
        [],
        [],
        baseSemesterStart,
        baseSemesterEnd
      );
      // Oct 1 to Oct 15:
      // Oct 1 is Thu. Mondays: Oct 5, Oct 12. So 2 Mondays past.
      expect(stats.totalHeld).toBe(2);
      expect(stats.attended).toBe(2);
      expect(stats.percentage).toBe(100);
    });

    it('handles rounding direction accurately', () => {
      const stats = calculateAttendance(
        'subj-1',
        [defaultSlot, { ...defaultSlot, id: 'slot-2', weekday: 2 }], // Mon, Tue -> 2 each = 4 total classes held
        [],
        [{ id: 'c1', user_id: '', subject_id: 'subj-1', slot_id: 'slot-1', date: '2026-10-05', type: 'absent', note: '', created_at: '' }],
        baseSemesterStart,
        baseSemesterEnd
      );
      // Total Held = 4. Attended = 3. 3/4 = 75%
      expect(stats.totalHeld).toBe(4);
      expect(stats.percentage).toBe(75);
    });

    it('treats cancelled classes as excluded from totalHeld', () => {
      const stats = calculateAttendance(
        'subj-1',
        [defaultSlot], // 2 classes held by Oct 15 (Oct 5, Oct 12)
        [],
        [{ id: 'c1', user_id: '', subject_id: 'subj-1', slot_id: 'slot-1', date: '2026-10-05', type: 'cancelled', note: '', created_at: '' }],
        baseSemesterStart,
        baseSemesterEnd
      );
      // One is cancelled, so only 1 held, 1 attended
      expect(stats.totalHeld).toBe(1);
      expect(stats.attended).toBe(1);
      expect(stats.percentage).toBe(100);
      expect(stats.cancelled).toBe(1);
    });

    it('handles overlapping day_overrides and class_overrides appropriately', () => {
      const stats = calculateAttendance(
        'subj-1',
        [defaultSlot], // 2 classes: Oct 5, Oct 12
        [{ id: 'd1', user_id: '', semester_id: '', date: '2026-10-05', type: 'mass_bunk', label: null, created_at: '' }],
        [
          // Even if explicitly marked present/cancelled on a mass bunk day, how is it handled?
          // Currently: 'cancelled' classOverride beats 'mass_bunk' dayOverride (cancelled takes precedence).
          { id: 'c1', user_id: '', subject_id: 'subj-1', slot_id: 'slot-1', date: '2026-10-05', type: 'cancelled', note: '', created_at: '' }
        ],
        baseSemesterStart,
        baseSemesterEnd
      );
      
      // Expected behavior based on current code:
      // The day is a mass_bunk, BUT the class is cancelled. Cancelled logic evaluates first and skips the class.
      // So totalHeld = 1 (Oct 12 is default present). 
      expect(stats.totalHeld).toBe(1);
      expect(stats.attended).toBe(1);
      expect(stats.cancelled).toBe(1);
      expect(stats.absent).toBe(0);
    });

    it('mass_bunk overrides a manual present mark', () => {
        // We do not have a "present" type in class_overrides (it's default).
        const stats = calculateAttendance(
            'subj-1',
            [defaultSlot], // Oct 5, Oct 12
            [{ id: 'd1', user_id: '', semester_id: '', date: '2026-10-05', type: 'mass_bunk', label: null, created_at: '' }],
            [],
            baseSemesterStart,
            baseSemesterEnd
          );
          expect(stats.totalHeld).toBe(2);
          expect(stats.absent).toBe(1); // from mass bunk
          expect(stats.massBunkCount).toBe(1);
          expect(stats.attended).toBe(1); // Oct 12
    });

    it('holiday day_override completely removes all classes on that day from totalHeld', () => {
      const stats = calculateAttendance(
        'subj-1',
        [defaultSlot], // Oct 5, Oct 12
        [{ id: 'd1', user_id: '', semester_id: '', date: '2026-10-05', type: 'holiday', label: null, created_at: '' }],
        [],
        baseSemesterStart,
        baseSemesterEnd
      );
      // Oct 5 is a holiday, so only Oct 12 is held.
      expect(stats.totalHeld).toBe(1);
      expect(stats.attended).toBe(1);
    });
  });

  describe('calculateBunkability', () => {
    it('calculates safe misses accurately for future classes', () => {
      // Current date: Oct 15
      // Semester ends: Oct 31
      // Remaining Mondays: Oct 19, Oct 26 (2 classes)
      // Already held: Oct 5, Oct 12 (2 classes)
      // Attended: 2. Total Held: 2. Remaining: 2. Total after: 4. Target: 75%
      // Needed for 75% of 4 = 3 classes.
      // We have attended 2, so we need to attend 1 out of remaining 2.
      // Which means we can safely miss 1.
      
      const bunkStats = calculateBunkability(
        2, 2, 'subj-1',
        [defaultSlot],
        [],
        baseSemesterEnd,
        75
      );
      
      expect(bunkStats.remaining).toBe(2);
      expect(bunkStats.safeMisses).toBe(1);
      expect(bunkStats.classesNeeded).toBe(0);
      expect(bunkStats.isImpossible).toBe(false);
    });
  });
});
