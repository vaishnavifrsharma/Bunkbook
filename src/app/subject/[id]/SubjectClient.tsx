'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { motion } from 'motion/react';
import type { Subject, TimetableSlot, DayOverride, ClassOverride, Semester } from '@/lib/types';
import { calculateAttendance, calculateBunkability } from '@/lib/attendance';
import { formatTime } from '@/lib/calendar-utils';
import { WEEKDAY_NAMES } from '@/lib/types';
import SketchedGauge from '@/components/ui/SketchedGauge';
import PaperCard from '@/components/ui/PaperCard';
import Button from '@/components/ui/Button';
import { format, parseISO } from 'date-fns';
import { useAttendanceData, AttendanceData } from '@/lib/useAttendanceData';

export default function SubjectClient({ subjectId, initialData }: { subjectId: string, initialData: AttendanceData }) {
  const router = useRouter();

  const { data, mutate } = useAttendanceData(initialData);
  const { semester, subjects, slots: allSlots, dayOverrides, classOverrides: allClassOverrides } = data || initialData;
  
  const subject = subjects.find(s => s.id === subjectId) || null;
  const slots = allSlots.filter(s => s.subject_id === subjectId);
  const classOverrides = allClassOverrides.filter(c => c.subject_id === subjectId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const supabase = createClient();

  const handleDeleteOverride = async (id: string) => {
    await supabase.from('class_overrides').delete().eq('id', id);
    mutate();
  };

  if (!subject || !semester) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-hand text-2xl text-[var(--ink-faint)]">Subject not found.</p>
      </div>
    );
  }

  const stats = calculateAttendance(subjectId, allSlots, dayOverrides, classOverrides, semester.start_date, semester.end_date);
  const bunk = calculateBunkability(stats.attended, stats.totalHeld, subjectId, allSlots, dayOverrides, semester.end_date, subject.target_pct);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => router.push('/dashboard')}
        className="text-[var(--ink-faint)] hover:text-[var(--ink)] text-body text-sm mb-4 flex items-center gap-1"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back to Dashboard
      </button>

      {/* Header */}
      <div className="flex items-start gap-6 mb-6 flex-wrap">
        <SketchedGauge
          percentage={stats.percentage}
          size={150}
          strokeWidth={10}
          targetPct={subject.target_pct}
          condonationPct={subject.condonation_pct}
        />

        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full" style={{ background: subject.color }} />
            <h1 className="page-title">{subject.name}</h1>
          </div>
          <span
            className="inline-block text-xs text-body px-2 py-0.5 rounded-full mb-4"
            style={{ background: `${subject.color}15`, color: subject.color, border: `1px solid ${subject.color}30` }}
          >
            {subject.type}
          </span>

          <div className="grid grid-cols-2 gap-3">
            <div className="text-body">
              <p className="text-sm text-[var(--ink-faint)]">Attended</p>
              <p className="text-xl font-semibold">{stats.attended} / {stats.totalHeld}</p>
            </div>
            <div className="text-body">
              <p className="text-sm text-[var(--ink-faint)]">Absent</p>
              <p className="text-xl font-semibold text-[var(--status-red)]">{stats.absent}</p>
            </div>
            <div className="text-body">
              <p className="text-sm text-[var(--ink-faint)]">Cancelled</p>
              <p className="text-xl font-semibold">{stats.cancelled}</p>
            </div>
            <div className="text-body">
              <p className="text-sm text-[var(--ink-faint)]">Target</p>
              <p className="text-xl font-semibold">{subject.target_pct}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bunk Calculator */}
      <PaperCard className="mb-6" glowColor={bunk.isImpossible ? 'rgba(192,57,43,0.1)' : 'rgba(45,139,78,0.1)'}>
        <div className="relative z-10 p-5">
          <h2 className="text-2xl mb-3">📊 Bunk Calculator</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-body">
            <div>
              <p className="text-sm text-[var(--ink-faint)]">Remaining Classes</p>
              <p className="text-2xl font-bold text-hand">{bunk.remaining}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--ink-faint)]">Safe Misses</p>
              <p className={`text-2xl font-bold text-hand ${bunk.safeMisses > 0 ? 'text-[var(--status-green)]' : 'text-[var(--status-red)]'}`}>
                {bunk.safeMisses}
              </p>
            </div>
            {bunk.classesNeeded > 0 && (
              <div>
                <p className="text-sm text-[var(--ink-faint)]">Must Attend</p>
                <p className="text-2xl font-bold text-hand text-[var(--status-yellow)]">
                  {bunk.classesNeeded}
                </p>
              </div>
            )}
            {bunk.isImpossible && (
              <div className="col-span-2">
                <div className="margin-note mt-1">
                  ⚠ Cannot reach {subject.target_pct}% — even attending all remaining {bunk.remaining} classes won&apos;t be enough.
                </div>
              </div>
            )}
          </div>
        </div>
      </PaperCard>

      {/* Schedule */}
      <PaperCard className="mb-6">
        <div className="relative z-10 p-5">
          <h2 className="text-2xl mb-3">🗓️ Schedule</h2>
          {slots.length > 0 ? (
            <div className="space-y-2">
              {slots.sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time)).map(slot => (
                <div key={slot.id} className="flex items-center gap-3 text-body text-sm">
                  <span className="w-24 text-[var(--ink-faint)]">{WEEKDAY_NAMES[slot.weekday]}</span>
                  <span>{formatTime(slot.start_time)}</span>
                  {slot.end_time && <span className="text-[var(--ink-faint)]">→ {formatTime(slot.end_time)}</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-body text-sm text-[var(--ink-faint)]">
              No slots configured — add them in the Timetable page.
            </p>
          )}
        </div>
      </PaperCard>

      {/* History / Logbook */}
      <PaperCard>
        <div className="relative z-10 p-5">
          <h2 className="text-2xl mb-3">📋 Logbook</h2>
          {classOverrides.length > 0 ? (
            <div className="space-y-1">
              {classOverrides.map(override => {
                const slot = slots.find(s => s.id === override.slot_id);
                return (
                  <motion.div
                    key={override.id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-[rgba(180,175,168,0.06)] group"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <span className={`status-chip ${override.type === 'absent' ? 'absent' : 'cancelled'}`} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                      {override.type === 'absent' ? '✗' : '✕'}
                    </span>
                    <span className="text-body text-sm flex-1">
                      {format(parseISO(override.date), 'MMM d, yyyy')}
                      {slot && ` • ${formatTime(slot.start_time)}`}
                    </span>
                    {override.note && (
                      <span className="text-body text-xs text-[var(--ink-faint)] italic">{override.note}</span>
                    )}
                    <button
                      onClick={() => handleDeleteOverride(override.id)}
                      className="text-[var(--ink-faint)] hover:text-[var(--status-red)] opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <p className="text-body text-sm text-[var(--ink-faint)]">
              No absences or cancellations logged for this subject yet. 🎉
            </p>
          )}
        </div>
      </PaperCard>
    </div>
  );
}
