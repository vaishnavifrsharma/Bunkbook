'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import type { Subject, TimetableSlot, DayOverride, ClassOverride, Semester, SubjectWithStats, ClassStatus } from '@/lib/types';
import { calculateAttendance, calculateBunkability } from '@/lib/attendance';
import { useAttendanceData, AttendanceData } from '@/lib/useAttendanceData';
import PaperCard from '@/components/ui/PaperCard';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { subscribeToPushNotifications } from '@/lib/push-utils';
import SubjectForm from '@/components/forms/SubjectForm';
import AbsenceForm from '@/components/forms/AbsenceForm';
import StatusBadge from '@/components/ui/StatusBadge';
import Link from 'next/link';
import { formatTime } from '@/lib/calendar-utils';
import { format } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TodayClass {
  slot: TimetableSlot;
  subject: Subject;
  status: ClassStatus;
  overrideId?: string;
}

export default function DashboardClient({ initialData }: { initialData: AttendanceData }) {
  const { data, mutate, isLoading } = useAttendanceData(initialData);
  const { semester, subjects, slots, dayOverrides, classOverrides } = data || initialData;
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [showAbsenceForm, setShowAbsenceForm] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [markingSlotId, setMarkingSlotId] = useState<string | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);

  const supabase = createClient();
  const router = useRouter();

  const handleSubscribe = async () => {
    try {
      setIsSubscribing(true);
      await subscribeToPushNotifications();
      alert('Notifications enabled successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to enable notifications. Make sure you are using an installed PWA or supported browser.');
    } finally {
      setIsSubscribing(false);
    }
  };

  // ─── Today logic ─────────────────────────────────────────────────────────
  const todayStr = new Date().toISOString().split('T')[0];
  const todayWeekday = new Date().getDay();
  const todayDayOverride = dayOverrides.find(d => d.date === todayStr);

  const classOverrideMap = new Map<string, ClassOverride>();
  classOverrides.forEach(c => classOverrideMap.set(`${c.slot_id}:${c.date}`, c));

  const subjectMap = new Map<string, Subject>();
  subjects.forEach(s => subjectMap.set(s.id, s));

  const todayClasses: TodayClass[] = slots
    .filter(s => s.weekday === todayWeekday)
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
    .map(slot => {
      const subject = subjectMap.get(slot.subject_id);
      if (!subject) return null;
      const override = classOverrideMap.get(`${slot.id}:${todayStr}`);
      let status: ClassStatus = 'present';
      if (todayDayOverride?.type === 'holiday') status = 'cancelled';
      else if (todayDayOverride?.type === 'mass_bunk') status = 'absent';
      else if (override?.type === 'absent') status = 'absent';
      else if (override?.type === 'cancelled') status = 'cancelled';
      return { slot, subject, status, overrideId: override?.id };
    })
    .filter(Boolean) as TodayClass[];

  // ─── Mark class ──────────────────────────────────────────────────────────
  const markClass = async (slot: TimetableSlot, newStatus: ClassStatus) => {
    setMarkingSlotId(slot.id);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMarkingSlotId(null); return; }

    if (newStatus === 'present') {
      await supabase.from('class_overrides').delete()
        .eq('slot_id', slot.id).eq('date', todayStr).eq('user_id', user.id);
    } else {
      await supabase.from('class_overrides').upsert({
        user_id: user.id,
        subject_id: slot.subject_id,
        slot_id: slot.id,
        date: todayStr,
        type: newStatus,
      }, { onConflict: 'user_id,slot_id,date' });
    }
    await mutate();
    setMarkingSlotId(null);
  };

  // ─── Mark whole day ───────────────────────────────────────────────────────
  const markDay = async (type: 'holiday' | 'mass_bunk' | null) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !semester) return;
    if (type === null) {
      await supabase.from('day_overrides').delete()
        .eq('date', todayStr).eq('semester_id', semester.id).eq('user_id', user.id);
    } else {
      await supabase.from('day_overrides').upsert({
        user_id: user.id, semester_id: semester.id,
        date: todayStr, type, label: type === 'holiday' ? 'Holiday' : null,
      }, { onConflict: 'user_id,semester_id,date' });
    }
    await mutate();
  };

  // ─── Subject stats ────────────────────────────────────────────────────────
  const subjectsWithStats = subjects.map(subject => {
    const stats = calculateAttendance(subject.id, slots, dayOverrides, classOverrides, semester?.start_date || '', semester?.end_date || '');
    const bunk = calculateBunkability(stats.attended, stats.totalHeld, subject.id, slots, dayOverrides, semester?.end_date || '', subject.target_pct);
    return { ...subject, stats, bunk };
  });

  const totalHeld = subjectsWithStats.reduce((s, x) => s + x.stats.totalHeld, 0);
  const totalAttended = subjectsWithStats.reduce((s, x) => s + x.stats.attended, 0);
  const overallPct = totalHeld > 0 ? (totalAttended / totalHeld) * 100 : 100;
  const atRiskCount = subjectsWithStats.filter(s => s.stats.percentage < s.target_pct).length;

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.p className="text-hand text-xl text-[var(--ink-faint)]"
          animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }}>
          Loading…
        </motion.p>
      </div>
    );
  }

  if (!semester) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <PaperCard className="max-w-sm w-full">
          <div className="p-8 text-center">
            <div className="text-5xl mb-4">📓</div>
            <h1 className="text-2xl mb-2">Welcome to BunkBook</h1>
            <p className="text-[var(--ink-light)] text-sm mb-6">Start by creating your first semester.</p>
            <Link href="/semesters">
              <Button variant="primary" size="lg">Create Semester →</Button>
            </Link>
          </div>
        </PaperCard>
      </div>
    );
  }

  const statusConfig = {
    present:   { label: '✓ Present',    chipClass: 'chip-present' },
    absent:    { label: '✗ Bunked',     chipClass: 'chip-absent' },
    cancelled: { label: '— Cancelled',  chipClass: 'chip-cancelled' },
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto pb-32 md:pb-10">

      {/* ── Page Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">{format(new Date(), 'EEEE, d MMM')}</h1>
          <p className="page-subtitle">{semester.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleSubscribe} 
            disabled={isSubscribing}
            className="p-2 rounded-full border-2 border-[var(--grid-line-strong)] text-[var(--ink-faint)] hover:text-[var(--ink)] hover:border-[var(--ink-light)] transition-all"
            title="Enable Notifications"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          </button>
          <Button variant="primary" onClick={() => setShowSubjectForm(true)}>+ Subject</Button>
        </div>
      </div>

      {/* ── TODAY'S CLASSES (primary action area) ──────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-label">Today’s Classes</h2>
          {/* Day-level actions */}
          <div className="flex gap-2">
            <button
              onClick={() => markDay(todayDayOverride?.type === 'holiday' ? null : 'holiday')}
              className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${
                todayDayOverride?.type === 'holiday'
                  ? 'bg-[#A6BFD2] border-[#A6BFD2] text-[var(--ink)]'
                  : 'border-[var(--grid-line-strong)] text-[var(--ink-faint)] hover:border-[#A6BFD2] hover:text-[var(--ink)]'
              }`}
            >Holiday</button>
            <button
              onClick={() => markDay(todayDayOverride?.type === 'mass_bunk' ? null : 'mass_bunk')}
              className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${
                todayDayOverride?.type === 'mass_bunk'
                  ? 'bg-[var(--status-red-bg)] border-[var(--status-red)] text-[var(--status-red)]'
                  : 'border-[var(--grid-line-strong)] text-[var(--ink-faint)] hover:border-[var(--status-red)] hover:text-[var(--status-red)]'
              }`}
            >Mass Bunk</button>
          </div>
        </div>

        {todayClasses.length === 0 ? (
          <div className="paper-card p-8 text-center text-[var(--ink-faint)] text-sm font-medium">
            No classes scheduled for today 🎉
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {todayClasses.map(cls => {
              const isMarking = markingSlotId === cls.slot.id;
              const isDayLocked = !!todayDayOverride;
              return (
                <motion.div
                  key={cls.slot.id}
                  className="paper-card px-4 py-3 flex items-center gap-4"
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Color dot */}
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: cls.subject.color }} />

                  {/* Subject info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[var(--ink)] text-base leading-tight truncate">{cls.subject.name}</p>
                    {cls.slot.start_time && (
                      <p className="text-xs text-[var(--ink-faint)] font-medium mt-0.5">{formatTime(cls.slot.start_time)}</p>
                    )}
                  </div>

                  {/* Status mark buttons */}
                  {isDayLocked ? (
                    <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-[var(--grid-line)] text-[var(--ink-faint)]">
                      {todayDayOverride?.type === 'holiday' ? 'Holiday' : 'Mass Bunk'}
                    </span>
                  ) : (
                    <div className="flex gap-2 shrink-0">
                      {(['present', 'absent', 'cancelled'] as ClassStatus[]).map(s => (
                        <button
                          key={s}
                          disabled={isMarking}
                          onClick={() => markClass(cls.slot, s)}
                          className={`flex items-center justify-center w-12 h-10 text-base font-bold rounded-xl border-2 transition-all active:scale-95 ${
                            cls.status === s
                              ? s === 'present'   ? 'bg-[var(--status-green)]  border-[var(--status-green)]  text-white shadow-sm'
                              : s === 'absent'    ? 'bg-[var(--status-red)]    border-[var(--status-red)]    text-white shadow-sm'
                              :                     'bg-[var(--ink-faint)]      border-[var(--ink-faint)]     text-white shadow-sm'
                              : s === 'present'   ? 'border-[var(--status-green)]  text-[var(--status-green)]  hover:bg-[var(--status-green-bg)]'
                              : s === 'absent'    ? 'border-[var(--status-red)]    text-[var(--status-red)]    hover:bg-[var(--status-red-bg)]'
                              :                     'border-[var(--ink-faint)]      text-[var(--ink-faint)]     hover:bg-[var(--grid-line)]'
                          }`}
                        >
                          {s === 'present' ? '✓' : s === 'absent' ? '✗' : '—'}
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── QUICK STATS ─────────────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="section-label mb-3">Overview</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Overall',  value: `${Math.round(overallPct * 10) / 10}%`, color: 'var(--ink)' },
            { label: 'Attended', value: `${totalAttended}/${totalHeld}`,          color: 'var(--ink)' },
            { label: 'At Risk',  value: String(atRiskCount), color: atRiskCount > 0 ? 'var(--status-red)' : 'var(--status-green)' },
          ].map(stat => (
            <PaperCard key={stat.label}>
              <div className="p-4 text-center">
                <p className="text-2xl font-extrabold font-serif tracking-tight" style={{ color: stat.color }}>
                  {stat.value}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--ink-faint)] mt-1">
                  {stat.label}
                </p>
              </div>
            </PaperCard>
          ))}
        </div>
      </section>

      {/* ── SUBJECT LIST (clean, stats only) ────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-label">Subjects</h2>
        </div>

        {subjectsWithStats.length === 0 ? (
          <PaperCard>
            <div className="p-8 text-center">
              <p className="text-[var(--ink-light)] mb-4">No subjects yet.</p>
              <Button variant="primary" onClick={() => setShowSubjectForm(true)}>+ Add Subject</Button>
            </div>
          </PaperCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {subjectsWithStats.map((subject, i) => {
              const pct = Math.round(subject.stats.percentage * 10) / 10;
              const isSafe    = subject.stats.percentage >= subject.target_pct;
              const isWarning = subject.stats.percentage >= subject.condonation_pct && !isSafe;
              const barColor  = isSafe ? 'var(--status-green)' : isWarning ? 'var(--status-yellow)' : 'var(--status-red)';
              return (
                <motion.div
                  key={subject.id}
                  className="subject-tile"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: i * 0.05 }}
                >
                  {/* Color accent bar */}
                  <div className="h-1.5" style={{ background: subject.color }} />

                  <div className="p-4">
                    {/* Row 1: name + type + edit */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <Link href={`/subject/${subject.id}`} className="flex-1 min-w-0">
                        <p className="font-bold text-[var(--ink)] text-[1.05rem] leading-snug truncate">{subject.name}</p>
                      </Link>
                      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                        <span
                          className="text-[9px] font-extrabold px-1.5 py-0.5 rounded tracking-widest uppercase"
                          style={{ background: `${subject.color}22`, color: subject.color }}
                        >
                          {subject.type === 'lecture' ? 'LEC' : subject.type === 'lab' ? 'LAB' : 'TUT'}
                        </span>
                        <button
                          onClick={() => { setEditingSubject(subject); setShowSubjectForm(true); }}
                          className="p-1 rounded text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Row 2: Safe Bunks hero */}
                    <div className="flex items-end justify-between mb-2 mt-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[2.2rem] font-extrabold font-serif leading-none tracking-tight" style={{ color: barColor }}>
                          {subject.bunk.safeMisses >= 0 && subject.bunk.safeMisses > 0 ? subject.bunk.safeMisses : subject.bunk.classesNeeded}
                        </span>
                        <span className="text-sm font-bold leading-none pb-1" style={{ color: barColor }}>
                          {subject.bunk.safeMisses >= 0 && subject.bunk.safeMisses > 0 ? (subject.bunk.safeMisses === 1 ? 'Safe Bunk' : 'Safe Bunks') : 'To Attend'}
                        </span>
                      </div>
                      <div className="flex flex-col items-end text-right leading-tight">
                        <span className="text-sm font-bold text-[var(--ink)]">
                          {pct}%
                        </span>
                        <span className="text-[10px] font-semibold text-[var(--ink-faint)] uppercase tracking-wider mt-0.5">
                          {subject.stats.attended}/{subject.stats.totalHeld} classes
                        </span>
                      </div>
                    </div>

                    {/* Row 3: progress bar */}
                    <div className="w-full h-2 rounded-full bg-[var(--grid-line-strong)] overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: barColor }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, Math.max(0, subject.stats.percentage))}%` }}
                        transition={{ duration: 0.7, ease: 'easeOut', delay: i * 0.05 }}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── MODALS ───────────────────────────────────────────────────────── */}
      <Modal isOpen={showSubjectForm} onClose={() => { setShowSubjectForm(false); setEditingSubject(null); }}
        title={editingSubject ? 'Edit Subject' : 'Add Subject'}>
        <SubjectForm semesterId={semester.id} subject={editingSubject}
          onSuccess={() => { setShowSubjectForm(false); setEditingSubject(null); mutate(); }} />
      </Modal>

      <Modal isOpen={showAbsenceForm} onClose={() => setShowAbsenceForm(false)} title="Log an Absence">
        <AbsenceForm subjects={subjects} slots={slots}
          onSuccess={() => { setShowAbsenceForm(false); mutate(); }} />
      </Modal>
    </div>
  );
}
