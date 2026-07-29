'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'motion/react';
import type { Subject, TimetableSlot, DayOverride, ClassOverride, Semester, CalendarClass, ClassStatus, DayOverrideType } from '@/lib/types';
import { WEEKDAY_SHORT } from '@/lib/types';
import { getCalendarDays, toDateString, isToday, isSameMonthAs, formatTime, isFutureDate, isInSemester } from '@/lib/calendar-utils';
import { useAttendanceData, AttendanceData } from '@/lib/useAttendanceData';
import PaperCard from '@/components/ui/PaperCard';
import Button from '@/components/ui/Button';
import { format, addMonths, subMonths } from 'date-fns';

export default function CalendarClient({ initialData }: { initialData: AttendanceData }) {
  const { data, mutate, isLoading } = useAttendanceData(initialData);
  const { semester, subjects, slots, dayOverrides, classOverrides } = data || initialData;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const supabase = createClient();

  // Calendar days for current month
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const calendarDays = getCalendarDays(year, month);

  // Build lookup maps
  const dayOverrideMap = new Map<string, DayOverride>();
  dayOverrides.forEach(d => dayOverrideMap.set(d.date, d));

  const classOverrideMap = new Map<string, ClassOverride>();
  classOverrides.forEach(c => classOverrideMap.set(`${c.slot_id}:${c.date}`, c));

  const subjectMap = new Map<string, Subject>();
  subjects.forEach(s => subjectMap.set(s.id, s));

  // Get classes for a given date
  function getClassesForDate(dateStr: string, weekday: number): CalendarClass[] {
    const daySlots = slots.filter(s => s.weekday === weekday);
    return daySlots.map(slot => {
      const subject = subjectMap.get(slot.subject_id);
      if (!subject) return null;
      const override = classOverrideMap.get(`${slot.id}:${dateStr}`);
      const dayOv = dayOverrideMap.get(dateStr);

      let status: ClassStatus = 'present';
      if (dayOv?.type === 'holiday') status = 'cancelled';
      else if (dayOv?.type === 'mass_bunk') status = 'absent';
      else if (override?.type === 'absent') status = 'absent';
      else if (override?.type === 'cancelled') status = 'cancelled';

      return { slot, subject, status, overrideId: override?.id };
    }).filter(Boolean) as CalendarClass[];
  }

  // Set class status explicitly
  const markClassStatus = async (slot: TimetableSlot, dateStr: string, newStatus: ClassStatus) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (newStatus === 'present') {
      // Remove the override
      await supabase.from('class_overrides')
        .delete()
        .eq('slot_id', slot.id)
        .eq('date', dateStr)
        .eq('user_id', user.id);
    } else {
      // Upsert the override
      await supabase.from('class_overrides')
        .upsert({
          user_id: user.id,
          subject_id: slot.subject_id,
          slot_id: slot.id,
          date: dateStr,
          type: newStatus,
        }, { onConflict: 'user_id,slot_id,date' });
    }

    mutate();
  };

  // Set day override
  const setDayOverride = async (dateStr: string, type: DayOverrideType | null, label?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !semester) return;

    if (type === null) {
      // Remove day override
      await supabase.from('day_overrides')
        .delete()
        .eq('date', dateStr)
        .eq('semester_id', semester.id)
        .eq('user_id', user.id);
    } else {
      await supabase.from('day_overrides')
        .upsert({
          user_id: user.id,
          semester_id: semester.id,
          date: dateStr,
          type,
          label: label || null,
        }, { onConflict: 'user_id,semester_id,date' });
    }

    mutate();
  };

  // Selected date classes
  const selectedDateObj = selectedDate ? new Date(selectedDate + 'T00:00:00') : null;
  const selectedClasses = selectedDate && selectedDateObj
    ? getClassesForDate(selectedDate, selectedDateObj.getDay())
    : [];
  const selectedDayOverride = selectedDate ? dayOverrideMap.get(selectedDate) : undefined;

  if (!semester) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <PaperCard className="max-w-md w-full text-center p-8">
          <p className="text-hand text-xl text-[var(--ink-light)]">
            Create a semester first to use the calendar.
          </p>
        </PaperCard>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto pb-32 md:pb-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Calendar</h1>
          <p className="page-subtitle">{semester.name}</p>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          className="p-2.5 rounded-xl border border-[var(--grid-line-strong)] hover:border-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/10 transition-all"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <h2 className="text-xl font-bold font-serif text-[var(--ink)]">{format(currentDate, 'MMMM yyyy')}</h2>
        <button
          onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          className="p-2.5 rounded-xl border border-[var(--grid-line-strong)] hover:border-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/10 transition-all"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </div>

      {/* Calendar grid */}
      <div className="paper-card mb-4 overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-[var(--grid-line-strong)]">
          {WEEKDAY_SHORT.map(day => (
            <div key={day} className="text-center text-[11px] font-extrabold uppercase tracking-widest text-[var(--ink-faint)] py-3">
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            const dateStr = toDateString(day);
            const dayOv = dayOverrideMap.get(dateStr);
            const weekday = day.getDay();
            const inMonth = isSameMonthAs(day, currentDate);
            const today = isToday(day);
            const inSem = semester ? isInSemester(day, semester.start_date, semester.end_date) : false;
            const isSelected = selectedDate === dateStr;
            const classes = inSem ? getClassesForDate(dateStr, weekday) : [];
            const isLastRow = idx >= calendarDays.length - 7;
            const isLastCol = (idx + 1) % 7 === 0;

            let bg = 'transparent';
            if (dayOv?.type === 'holiday') bg = 'rgba(166,191,210,0.25)';
            else if (dayOv?.type === 'mass_bunk') bg = 'rgba(185,28,28,0.1)';
            else if (today) bg = 'rgba(241,234,145,0.45)';
            if (isSelected) bg = 'rgba(166,191,210,0.45)';

            return (
              <motion.div
                key={dateStr}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={`
                  relative cursor-pointer flex flex-col items-center pt-2 pb-1.5 min-h-[56px] md:min-h-[72px]
                  ${!isLastRow ? 'border-b border-[var(--grid-line)]' : ''}
                  ${!isLastCol ? 'border-r border-[var(--grid-line)]' : ''}
                  transition-all duration-150
                `}
                style={{ background: bg }}
                whileTap={{ scale: 0.95 }}
              >
                {/* Date number */}
                <span className={`
                  w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold transition-all
                  ${!inMonth ? 'text-[var(--ink-faint)] opacity-40' : 'text-[var(--ink)]'}
                  ${today && !isSelected ? 'ring-2 ring-[var(--ink)] ring-offset-1' : ''}
                  ${isSelected ? 'bg-[var(--ink)] text-white' : ''}
                `}>
                  {day.getDate()}
                </span>

                {/* Day status icons */}
                {dayOv?.type === 'holiday'   && <span className="text-[10px] mt-0.5 font-bold uppercase text-[var(--ink-faint)]">Hol</span>}
                {dayOv?.type === 'mass_bunk' && <span className="text-[10px] mt-0.5 font-bold uppercase text-[var(--status-red)]">Bunk</span>}

                {/* Class dots */}
                {classes.length > 0 && !dayOv?.type && (
                  <div className="flex gap-[3px] mt-1 flex-wrap justify-center max-w-[40px]">
                    {classes.slice(0, 4).map((cls, i) => (
                      <div
                        key={i}
                        className={`w-[7px] h-[7px] rounded-full ${cls.status === 'absent' ? 'opacity-40 ring-1 ring-[var(--status-red)]' : cls.status === 'cancelled' ? 'opacity-20' : 'opacity-90'}`}
                        style={{ background: cls.subject.color }}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Day Detail Panel */}
      <AnimatePresence>
        {selectedDate && selectedDateObj && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            <div className="paper-card overflow-hidden">
              {/* Day header */}
              <div className="px-5 py-4 border-b border-[var(--grid-line)] flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold font-serif text-[var(--ink)]">
                    {format(selectedDateObj, 'EEEE, MMMM d')}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDayOverride(selectedDate, selectedDayOverride?.type === 'holiday' ? null : 'holiday', 'Holiday')}
                    className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${selectedDayOverride?.type === 'holiday' ? 'bg-[#A6BFD2] border-[#A6BFD2] text-[var(--ink)]' : 'border-[var(--grid-line-strong)] text-[var(--ink-faint)] hover:border-[#A6BFD2] hover:text-[var(--ink)]'}`}
                  >Holiday</button>
                  <button
                    onClick={() => setDayOverride(selectedDate, selectedDayOverride?.type === 'mass_bunk' ? null : 'mass_bunk')}
                    className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${selectedDayOverride?.type === 'mass_bunk' ? 'bg-[var(--status-red-bg)] border-[var(--status-red)] text-[var(--status-red)]' : 'border-[var(--grid-line-strong)] text-[var(--ink-faint)] hover:border-[var(--status-red)] hover:text-[var(--status-red)]'}`}
                  >Mass Bunk</button>
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="ml-1 p-1.5 rounded-lg text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Class slots */}
              {selectedClasses.length > 0 ? (
                <div>
                  {selectedClasses.map((cls, i) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-[var(--grid-line)] last:border-0">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cls.subject.color }} />
                      <span className="text-xs font-semibold text-[var(--ink-faint)] w-14 shrink-0">
                        {formatTime(cls.slot.start_time)}
                      </span>
                      <span className="text-sm font-semibold text-[var(--ink)] flex-1 truncate">{cls.subject.name}</span>
                      <div className="flex gap-2 shrink-0">
                        {(['present', 'absent', 'cancelled'] as const).map(s => (
                          <button
                            key={s}
                            className={`flex items-center justify-center w-11 h-9 text-base font-bold rounded-xl border-2 transition-all active:scale-95 ${
                              cls.status === s
                                ? s === 'present'   ? 'bg-[var(--status-green)]  border-[var(--status-green)]  text-white shadow-sm'
                                : s === 'absent'    ? 'bg-[var(--status-red)]    border-[var(--status-red)]    text-white shadow-sm'
                                :                     'bg-[var(--ink-faint)]      border-[var(--ink-faint)]     text-white shadow-sm'
                                : s === 'present'   ? 'border-[var(--status-green)]  text-[var(--status-green)]  hover:bg-[var(--status-green-bg)]'
                                : s === 'absent'    ? 'border-[var(--status-red)]    text-[var(--status-red)]    hover:bg-[var(--status-red-bg)]'
                                :                     'border-[var(--ink-faint)]      text-[var(--ink-faint)]     hover:bg-[var(--grid-line)]'
                            }`}
                            onClick={() => markClassStatus(cls.slot, selectedDate, s)}
                            disabled={!!selectedDayOverride}
                          >
                            {s === 'present' ? '✓' : s === 'absent' ? '✗' : '—'}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-[var(--ink-faint)] text-sm">No classes this day</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 text-[11px] font-semibold text-[var(--ink-faint)]">
        <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#4CAF50]"/>Present</span>
        <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#E53935] opacity-50"/>Bunked</span>
        <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#9E9E9E] opacity-40"/>Cancelled</span>
        <span className="flex items-center gap-1.5">Holiday</span>
        <span className="flex items-center gap-1.5">Mass Bunk</span>
      </div>
    </div>
  );
}

