'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createClient } from '@/lib/supabase/client';
import type { SubjectWithStats } from '@/lib/types';
import StatusBadge from '@/components/ui/StatusBadge';
import Link from 'next/link';

interface SubjectCardProps {
  subject: SubjectWithStats;
  delay?: number;
  onEdit?: () => void;
  onRefresh?: () => void;
}

const typeLabels: Record<string, string> = {
  lecture: 'LEC',
  lab: 'LAB',
  tutorial: 'TUT',
};

export default function SubjectCard({ subject, delay = 0, onEdit, onRefresh }: SubjectCardProps) {
  const { stats, bunk } = subject;
  const pct = Math.round(stats.percentage * 10) / 10;
  const [marking, setMarking] = useState(false);

  const isSafe    = stats.percentage >= subject.target_pct;
  const isWarning = stats.percentage >= subject.condonation_pct && !isSafe;
  const barColor  = isSafe ? 'var(--status-green)' : isWarning ? 'var(--status-yellow)' : 'var(--status-red)';

  const handleQuickMark = async (status: 'present' | 'absent' | 'cancelled') => {
    setMarking(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];
      const weekday = new Date().getDay();

      // Find today's slots for this subject
      const todaySlots = subject.slots?.filter(s => s.weekday === weekday) ?? [];
      if (todaySlots.length === 0) return;

      for (const slot of todaySlots) {
        if (status === 'present') {
          // Remove any override → defaults to present
          await supabase.from('class_overrides')
            .delete()
            .eq('slot_id', slot.id)
            .eq('date', today)
            .eq('user_id', user.id);
        } else {
          await supabase.from('class_overrides')
            .upsert({
              user_id: user.id,
              subject_id: subject.id,
              slot_id: slot.id,
              date: today,
              type: status,
            }, { onConflict: 'user_id,slot_id,date' });
        }
      }
      onRefresh?.();
    } finally {
      setMarking(false);
    }
  };

  return (
    <motion.div
      className="paper-card flex flex-col"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
    >
      {/* ── Subject color accent bar ── */}
      <div className="h-1.5 rounded-t-[13px]" style={{ background: subject.color }} />

      <div className="p-4 flex flex-col gap-3 flex-1">

        {/* ── ROW 1: Name (primary) + type chip + edit ── */}
        <div className="flex items-start justify-between gap-2">
          <Link href={`/subject/${subject.id}`} className="flex-1 min-w-0">
            <h3 className="text-[1.15rem] font-bold font-serif leading-tight text-[var(--ink)] truncate">
              {subject.name}
            </h3>
          </Link>
          <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
            <span
              className="text-[10px] font-extrabold px-2 py-0.5 rounded tracking-widest uppercase"
              style={{ background: `${subject.color}1A`, color: subject.color }}
            >
              {typeLabels[subject.type] ?? subject.type}
            </span>
            <button
              onClick={(e) => { e.preventDefault(); onEdit?.(); }}
              className="p-1 rounded text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors"
              title="Edit"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── ROW 2: Big % + fraction ── */}
        <div className="flex items-baseline justify-between">
          <span className="text-[2.4rem] font-extrabold font-serif leading-none text-[var(--ink)] tracking-tight">
            {pct}%
          </span>
          <span className="text-sm font-semibold text-[var(--ink-faint)]">
            <span className="text-base font-bold text-[var(--ink)]">{stats.attended}</span>
            {' '}/{' '}{stats.totalHeld} classes
          </span>
        </div>

        {/* ── Progress bar ── */}
        <div className="w-full h-2 rounded-full bg-[var(--grid-line-strong)] overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: barColor }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, Math.max(0, stats.percentage))}%` }}
            transition={{ duration: 0.75, ease: 'easeOut', delay: delay + 0.1 }}
          />
        </div>

        {/* ── ROW 3: Status badge + advisory ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge
            percentage={stats.percentage}
            targetPct={subject.target_pct}
            condonationPct={subject.condonation_pct}
            size="sm"
          />
          {stats.massBunkCount > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[var(--status-red-bg)] text-[var(--status-red)]">
              {stats.massBunkCount} mass bunk{stats.massBunkCount > 1 ? 's' : ''}
            </span>
          )}
          {bunk.advisoryMessage && (
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
              bunk.isImpossible    ? 'bg-[var(--status-red-bg)]    text-[var(--status-red)]'
              : bunk.safeMisses > 0 ? 'bg-[var(--status-green-bg)]  text-[var(--status-green)]'
              :                       'bg-[var(--status-yellow-bg)] text-[var(--status-yellow)]'
            }`}>
              {bunk.advisoryMessage}
            </span>
          )}
        </div>

        {/* ── ROW 4: Quick-mark today's class ── */}
        <div className="pt-3 border-t border-[var(--grid-line)] mt-auto">
          <p className="text-[11px] font-bold text-[var(--ink-faint)] uppercase tracking-wider mb-2">
            Mark today
          </p>
          <div className="flex gap-2">
            <button
              className="mark-btn mark-btn-present"
              onClick={() => handleQuickMark('present')}
              disabled={marking}
              title="Mark Present"
            >
              ✓ Present
            </button>
            <button
              className="mark-btn mark-btn-absent"
              onClick={() => handleQuickMark('absent')}
              disabled={marking}
              title="Mark Absent"
            >
              ✗ Bunked
            </button>
            <button
              className="mark-btn mark-btn-cancel"
              onClick={() => handleQuickMark('cancelled')}
              disabled={marking}
              title="Mark Cancelled"
            >
              — Cancel
            </button>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
