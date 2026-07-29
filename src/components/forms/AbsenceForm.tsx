'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Subject, TimetableSlot, OverrideType } from '@/lib/types';
import { formatTime } from '@/lib/calendar-utils';
import { WEEKDAY_NAMES } from '@/lib/types';
import Button from '@/components/ui/Button';
import { format } from 'date-fns';

interface AbsenceFormProps {
  subjects: Subject[];
  slots: TimetableSlot[];
  onSuccess: () => void;
}

export default function AbsenceForm({ subjects, slots, onSuccess }: AbsenceFormProps) {
  const [selectedSubject, setSelectedSubject] = useState(subjects[0]?.id || '');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [overrideType, setOverrideType] = useState<OverrideType>('absent');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // Get slots for selected subject on the chosen date's weekday
  const dateObj = new Date(date + 'T00:00:00');
  const weekday = dateObj.getDay();
  const matchingSlots = slots.filter(
    s => s.subject_id === selectedSubject && s.weekday === weekday
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (matchingSlots.length === 0) {
        throw new Error(`No class scheduled for this subject on ${WEEKDAY_NAMES[weekday]}`);
      }

      // Create overrides for each matching slot on that day
      const overrides = matchingSlots.map(slot => ({
        user_id: user.id,
        subject_id: selectedSubject,
        slot_id: slot.id,
        date,
        type: overrideType,
        note: note.trim() || null,
      }));

      const { error: insertError } = await supabase
        .from('class_overrides')
        .upsert(overrides, { onConflict: 'user_id,slot_id,date' });

      if (insertError) throw insertError;
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Subject */}
      <div>
        <label className="label-notebook">Subject</label>
        <select
          className="input-notebook"
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
          required
        >
          {subjects.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Date */}
      <div>
        <label className="label-notebook">Date</label>
        <input
          type="date"
          className="input-notebook"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>

      {/* Matching slots info */}
      {selectedSubject && (
        <div className="text-body text-sm text-[var(--ink-faint)]">
          {matchingSlots.length > 0 ? (
            <p>
              📋 {matchingSlots.length} class{matchingSlots.length > 1 ? 'es' : ''} on{' '}
              {WEEKDAY_NAMES[weekday]}:{' '}
              {matchingSlots.map(s => formatTime(s.start_time)).join(', ')}
            </p>
          ) : (
            <p className="text-[var(--status-yellow)]">
              ⚠ No class scheduled for this subject on {WEEKDAY_NAMES[weekday]}
            </p>
          )}
        </div>
      )}

      {/* Type toggle */}
      <div>
        <label className="label-notebook">Type</label>
        <div className="flex gap-2">
          <button
            type="button"
            className={`status-chip ${overrideType === 'absent' ? 'absent' : ''}`}
            style={{
              borderColor: overrideType === 'absent' ? 'var(--status-red)' : 'var(--ink-faint)',
              color: overrideType === 'absent' ? 'var(--status-red)' : 'var(--ink-faint)',
              background: overrideType === 'absent' ? 'var(--status-red-bg)' : 'transparent',
            }}
            onClick={() => setOverrideType('absent')}
          >
            ✗ Absent (Bunked)
          </button>
          <button
            type="button"
            className={`status-chip ${overrideType === 'cancelled' ? 'cancelled' : ''}`}
            style={{
              borderColor: overrideType === 'cancelled' ? 'var(--ink-light)' : 'var(--ink-faint)',
              color: overrideType === 'cancelled' ? 'var(--ink-light)' : 'var(--ink-faint)',
              background: overrideType === 'cancelled' ? 'rgba(158,152,147,0.1)' : 'transparent',
            }}
            onClick={() => setOverrideType('cancelled')}
          >
            ✕ Cancelled
          </button>
        </div>
      </div>

      {/* Note */}
      <div>
        <label className="label-notebook">Note (optional)</label>
        <input
          type="text"
          className="input-notebook"
          placeholder="e.g., was sick, teacher absent..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {error && (
        <p className="text-sm text-[var(--status-red)] bg-[var(--status-red-bg)] p-3 rounded-md text-body">
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        disabled={loading || matchingSlots.length === 0}
        className="w-full"
      >
        {loading ? '...' : overrideType === 'absent' ? 'Log Absence' : 'Mark as Cancelled'}
      </Button>
    </form>
  );
}
