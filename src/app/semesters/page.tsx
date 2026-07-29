'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion } from 'motion/react';
import type { Semester } from '@/lib/types';
import PaperCard from '@/components/ui/PaperCard';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { format, parseISO } from 'date-fns';

export default function SemestersPage() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSemester, setEditingSemester] = useState<Semester | null>(null);
  const [duplicateFrom, setDuplicateFrom] = useState<Semester | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('semesters')
      .select('*')
      .order('created_at', { ascending: false });
    setSemesters(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openForm = (semester?: Semester) => {
    setDuplicateFrom(null);
    if (semester) {
      setEditingSemester(semester);
      setName(semester.name);
      setStartDate(semester.start_date);
      setEndDate(semester.end_date);
    } else {
      setEditingSemester(null);
      setName('');
      setStartDate('');
      setEndDate('');
    }
    setError(null);
    setShowForm(true);
  };

  const openDuplicateForm = (sourceSemester: Semester) => {
    setEditingSemester(null);
    setDuplicateFrom(sourceSemester);
    setName(`${sourceSemester.name} (Copy)`);
    setStartDate('');
    setEndDate('');
    setError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const payload = {
        user_id: user.id,
        name: name.trim(),
        start_date: startDate,
        end_date: endDate,
      };

      if (editingSemester) {
        const { error } = await supabase
          .from('semesters')
          .update(payload)
          .eq('id', editingSemester.id);
        if (error) throw error;
      } else if (duplicateFrom) {
        // 1. Deactivate current active semesters
        await supabase.from('semesters').update({ is_active: false }).eq('user_id', user.id);

        // 2. Create new active semester
        const { data: newSem, error: semErr } = await supabase
          .from('semesters')
          .insert({
            ...payload,
            is_active: true,
          })
          .select()
          .single();
        if (semErr) throw semErr;

        // 3. Fetch subjects from source semester
        const { data: sourceSubjects } = await supabase
          .from('subjects')
          .select('*')
          .eq('semester_id', duplicateFrom.id);

        if (sourceSubjects && sourceSubjects.length > 0) {
          const subjectIdMap = new Map<string, string>(); // oldId -> newId

          for (const sub of sourceSubjects) {
            const { data: newSub, error: subErr } = await supabase
              .from('subjects')
              .insert({
                user_id: user.id,
                semester_id: newSem.id,
                name: sub.name,
                type: sub.type,
                target_pct: sub.target_pct,
                condonation_pct: sub.condonation_pct,
                color: sub.color,
              })
              .select()
              .single();
            if (subErr) throw subErr;
            subjectIdMap.set(sub.id, newSub.id);
          }

          // 4. Fetch timetable slots from source semester
          const { data: sourceSlots } = await supabase
            .from('timetable_slots')
            .select('*')
            .eq('semester_id', duplicateFrom.id);

          if (sourceSlots && sourceSlots.length > 0) {
            const newSlots = sourceSlots.map(slot => ({
              user_id: user.id,
              semester_id: newSem.id,
              subject_id: subjectIdMap.get(slot.subject_id)!,
              weekday: slot.weekday,
              start_time: slot.start_time,
              end_time: slot.end_time,
            }));

            const { error: slotErr } = await supabase.from('timetable_slots').insert(newSlots);
            if (slotErr) throw slotErr;
          }
        }
      } else {
        const { error } = await supabase.from('semesters').insert({
          ...payload,
          is_active: semesters.length === 0,
        });
        if (error) throw error;
      }

      setShowForm(false);
      fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('semesters').update({ is_active: false }).eq('user_id', user.id);
    await supabase.from('semesters').update({ is_active: true }).eq('id', id);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this semester and ALL its subjects, timetable, and attendance data?')) return;
    await supabase.from('semesters').delete().eq('id', id);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.p className="text-hand text-2xl text-[var(--ink-faint)]"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >loading semesters...</motion.p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">Semesters</h1>
        <Button variant="primary" onClick={() => openForm()}>
          + New Semester
        </Button>
      </div>

      {semesters.length === 0 ? (
        <PaperCard glowColor="rgba(184,212,227,0.2)">
          <div className="relative z-10 p-8 text-center">
            <h2 className="text-2xl mb-2">No semesters yet</h2>
            <p className="text-body text-sm text-[var(--ink-light)] mb-4">
              Create your first semester to start tracking attendance.
            </p>
            <Button variant="primary" onClick={() => openForm()}>
              Create Semester
            </Button>
          </div>
        </PaperCard>
      ) : (
        <div className="space-y-3">
          {semesters.map((sem, i) => (
            <PaperCard key={sem.id} delay={0.03 * i}>
              <div className="relative z-10 p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-serif font-bold truncate">{sem.name}</h3>
                      {sem.is_active && (
                        <span className="status-safe text-xs px-2.5 py-0.5 rounded-full font-semibold text-hand">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-body text-sm text-[var(--ink-faint)] mt-1">
                      {format(parseISO(sem.start_date), 'MMM d, yyyy')} →{' '}
                      {format(parseISO(sem.end_date), 'MMM d, yyyy')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {!sem.is_active && (
                      <Button size="sm" onClick={() => setActive(sem.id)}>
                        Set Active
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => openDuplicateForm(sem)} title="Duplicate subjects & timetable to a new semester">
                      🚀 Duplicate
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openForm(sem)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(sem.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </PaperCard>
          ))}
        </div>
      )}

      {/* Semester Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={duplicateFrom ? `Duplicate "${duplicateFrom.name}"` : editingSemester ? 'Edit Semester' : 'New Semester'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {duplicateFrom && (
            <p className="text-body text-xs text-[var(--ink-light)] bg-[rgba(180,175,168,0.12)] p-2.5 rounded-md">
              ℹ This will copy all subjects and weekly timetable slots to the new semester with <strong>0 attendance logs</strong>.
            </p>
          )}

          <div>
            <label className="label-notebook">Semester Name</label>
            <input
              type="text"
              className="input-notebook"
              placeholder='e.g., "Sem 6 — Spring 2027"'
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-notebook">Start Date</label>
              <input
                type="date"
                className="input-notebook"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label-notebook">End Date</label>
              <input
                type="date"
                className="input-notebook"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-[var(--status-red)] bg-[var(--status-red-bg)] p-3 rounded-md text-body">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" disabled={saving} className="w-full">
            {saving ? '...' : duplicateFrom ? '🚀 Copy & Create Semester' : editingSemester ? 'Save Changes' : 'Create Semester'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
