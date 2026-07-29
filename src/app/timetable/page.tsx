'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'motion/react';
import type { Subject, TimetableSlot, Semester, TimetableTemplate } from '@/lib/types';
import { WEEKDAY_NAMES, SUBJECT_COLORS } from '@/lib/types';
import { formatTime } from '@/lib/calendar-utils';
import PaperCard from '@/components/ui/PaperCard';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

interface ParsedSlot {
  weekday: number;
  weekdayName: string;
  subject: string;
  type: 'lecture' | 'lab' | 'tutorial';
  start_time: string;
  end_time: string;
  weight?: number;
}

const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

function normalizeTime(t: string): string {
  if (!t) return '09:00';
  t = t.trim().toUpperCase();
  const ampm = t.includes('AM') ? 'am' : t.includes('PM') ? 'pm' : null;
  t = t.replace(/[APM\s]/g, '');

  let hours = 0, mins = 0;
  if (t.includes(':')) {
    [hours, mins] = t.split(':').map(Number);
  } else if (t.includes('.')) {
    [hours, mins] = t.split('.').map(Number);
  } else if (t.length <= 2) {
    hours = parseInt(t);
  } else if (t.length === 3) {
    hours = parseInt(t[0]);
    mins = parseInt(t.slice(1));
  } else if (t.length === 4) {
    hours = parseInt(t.slice(0, 2));
    mins = parseInt(t.slice(2));
  }

  if (ampm === 'pm' && hours < 12) hours += 12;
  if (ampm === 'am' && hours === 12) hours = 0;

  return `${String(hours).padStart(2, '0')}:${String(mins || 0).padStart(2, '0')}`;
}

export default function TimetablePage() {
  const [semester, setSemester] = useState<Semester | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [addSlotWeekday, setAddSlotWeekday] = useState(1);

  // Add slot form state
  const [slotSubject, setSlotSubject] = useState('');
  const [slotStartTime, setSlotStartTime] = useState('09:00');
  const [slotEndTime, setSlotEndTime] = useState('10:00');
  const [addingSlot, setAddingSlot] = useState(false);

  // Bulk import state
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [parsedSlots, setParsedSlots] = useState<ParsedSlot[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const templateFileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: semesters } = await supabase
      .from('semesters').select('*').eq('is_active', true).limit(1);
    const activeSemester = semesters?.[0] || null;
    setSemester(activeSemester);
    if (!activeSemester) { setLoading(false); return; }

    const [subRes, slotRes] = await Promise.all([
      supabase.from('subjects').select('*').eq('semester_id', activeSemester.id).order('name'),
      supabase.from('timetable_slots').select('*').eq('semester_id', activeSemester.id).order('start_time'),
    ]);

    setSubjects(subRes.data || []);
    setSlots(slotRes.data || []);
    if (subRes.data?.[0]) setSlotSubject(subRes.data[0].id);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingSlot(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !semester) return;

    await supabase.from('timetable_slots').insert({
      user_id: user.id,
      subject_id: slotSubject,
      semester_id: semester.id,
      weekday: addSlotWeekday,
      start_time: slotStartTime,
      end_time: slotEndTime || null,
    });

    setAddingSlot(false);
    setShowAddSlot(false);
    fetchData();
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm('Remove this class from the timetable?')) return;
    await supabase.from('timetable_slots').delete().eq('id', slotId);
    fetchData();
  };

  // ── Export Shared Timetable JSON ─────────────────────────────────────
  const handleExportTemplate = () => {
    if (!semester || subjects.length === 0) return;
    
    const subjectMap = new Map(subjects.map(s => [s.id, s]));

    const template: TimetableTemplate = {
      version: '1.0',
      title: `${semester.name} Timetable`,
      subjects: subjects.map(s => ({
        name: s.name,
        type: s.type,
        color: s.color,
        target_pct: s.target_pct,
        condonation_pct: s.condonation_pct,
      })),
      slots: slots.map(slot => {
        const sub = subjectMap.get(slot.subject_id);
        return {
          subjectName: sub?.name || 'Unknown',
          weekday: slot.weekday,
          start_time: slot.start_time,
          end_time: slot.end_time,
          weight: slot.weight || 1,
        };
      }),
    };

    const jsonStr = JSON.stringify(template, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${semester.name.replace(/\s+/g, '_')}_Timetable_Template.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Import Template File ─────────────────────────────────────────────
  const handleFileTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const template: TimetableTemplate = JSON.parse(content);

        if (!template.slots || !Array.isArray(template.slots)) {
          throw new Error('Invalid template format.');
        }

        const parsed: ParsedSlot[] = template.slots.map(s => ({
          weekday: s.weekday,
          weekdayName: WEEKDAY_NAMES[s.weekday],
          subject: s.subjectName,
          type: 'lecture',
          start_time: s.start_time,
          end_time: s.end_time || '',
          weight: s.weight || 1,
        }));

        setParsedSlots(parsed);
      } catch (err: unknown) {
        setImportError('Failed to import file: ' + (err instanceof Error ? err.message : 'Invalid JSON'));
      }
    };
    reader.readAsText(file);
  };

  // ── Text Bulk Import ──────────────────────────────────────────────

  const handleParseText = () => {
    setImportError(null);
    if (!importText.trim()) {
      setImportError('Please paste some text first.');
      return;
    }

    const lines = importText.split('\n').filter(l => l.trim().length > 0);
    const results: ParsedSlot[] = [];

    lines.forEach(line => {
      // Split by tab, pipe |, comma ,, or 2+ spaces
      const parts = line.split(/[\t|,]|\s{2,}/).map(p => p.trim()).filter(Boolean);
      
      if (parts.length >= 3) {
        const weekdayStr = parts[0].toLowerCase().trim();
        const wd = WEEKDAY_MAP[weekdayStr];
        
        if (wd !== undefined) {
          const subject = parts[1];
          const startTime = normalizeTime(parts[2]);
          const endTime = parts.length >= 4 ? normalizeTime(parts[3]) : normalizeTime(parts[2].replace('00', '50'));

          const isLab = subject.toLowerCase().includes('lab') || subject.toLowerCase().includes('prac');
          const isTut = subject.toLowerCase().includes('tut');

          results.push({
            weekday: wd,
            weekdayName: WEEKDAY_NAMES[wd],
            subject,
            type: isLab ? 'lab' : isTut ? 'tutorial' : 'lecture',
            start_time: startTime,
            end_time: endTime,
          });
        }
      }
    });

    if (results.length === 0) {
      setImportError('Could not parse text format. Ensure rows have Weekday | Subject | Start | End.');
      return;
    }

    setParsedSlots(results);
  };

  const removeSlot = (idx: number) => {
    setParsedSlots(prev => prev ? prev.filter((_, i) => i !== idx) : prev);
  };

  const handleSaveAll = async () => {
    if (!parsedSlots || !semester) return;
    setSaving(true);
    setImportError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const existingSubjectMap = new Map<string, Subject>();
      subjects.forEach(s => existingSubjectMap.set(s.name.toLowerCase(), s));

      const uniqueSubjectNames = [...new Set(parsedSlots.map(s => s.subject))];
      const subjectIdMap = new Map<string, string>();

      for (const name of uniqueSubjectNames) {
        const existing = existingSubjectMap.get(name.toLowerCase());
        if (existing) {
          subjectIdMap.set(name, existing.id);
        } else {
          const colorIndex = subjectIdMap.size % SUBJECT_COLORS.length;
          const { data: newSubject, error } = await supabase
            .from('subjects')
            .insert({
              user_id: user.id,
              semester_id: semester.id,
              name,
              type: parsedSlots.find(s => s.subject === name)?.type || 'lecture',
              color: SUBJECT_COLORS[colorIndex],
              target_pct: 75,
              condonation_pct: 65,
            })
            .select()
            .single();
          if (error) throw error;
          subjectIdMap.set(name, newSubject.id);
        }
      }

      const newSlots = parsedSlots.map(slot => ({
        user_id: user.id,
        semester_id: semester.id,
        subject_id: subjectIdMap.get(slot.subject)!,
        weekday: slot.weekday,
        start_time: slot.start_time,
        end_time: slot.end_time,
      }));

      const { error: slotError } = await supabase.from('timetable_slots').insert(newSlots);
      if (slotError) throw slotError;

      setShowImport(false);
      setImportText('');
      setParsedSlots(null);
      fetchData();
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const resetImport = () => {
    setImportText('');
    setParsedSlots(null);
    setImportError(null);
  };

  const subjectMap = new Map(subjects.map(s => [s.id, s]));

  const weekdays = [1, 2, 3, 4, 5, 6, 0];
  const slotsByWeekday = weekdays.map(wd => ({
    weekday: wd,
    name: WEEKDAY_NAMES[wd],
    slots: slots.filter(s => s.weekday === wd).sort((a, b) => a.start_time.localeCompare(b.start_time)),
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.p className="text-hand text-2xl text-[var(--ink-faint)]"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >loading timetable...</motion.p>
      </div>
    );
  }

  if (!semester) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <PaperCard className="max-w-md w-full text-center p-8">
          <p className="text-hand text-xl text-[var(--ink-light)]">Create a semester first.</p>
        </PaperCard>
      </div>
    );
  }

  if (subjects.length === 0 && !showImport) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <PaperCard className="max-w-md w-full text-center p-8" glowColor="rgba(184,212,227,0.25)">
          <p className="text-5xl mb-3">📋</p>
          <p className="text-serif font-bold text-2xl text-[var(--ink)] mb-2">
            Import Your Timetable!
          </p>
          <p className="text-body text-sm text-[var(--ink-light)] mb-5">
            Copy from Excel/ChatGPT, or upload a shared template file from a classmate.
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            <Button variant="primary" size="lg" onClick={() => setShowImport(true)}>
              📋 Bulk Text Import
            </Button>
            <Button variant="secondary" size="lg" onClick={() => templateFileInputRef.current?.click()}>
              📥 Import JSON File
            </Button>
          </div>
          <input
            ref={templateFileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileTemplateUpload}
          />
        </PaperCard>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="page-title">Timetable</h1>
          <p className="page-subtitle">
            {semester.name} • {slots.length} slots
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {slots.length > 0 && (
            <Button variant="secondary" size="sm" onClick={handleExportTemplate} title="Export timetable to share with classmates">
              📤 Export for Classmates
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={() => { resetImport(); setShowImport(true); }}>
            📋 Bulk Import
          </Button>
        </div>
      </div>

      {/* Weekly grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {slotsByWeekday.map(({ weekday, name, slots: daySlots }, idx) => (
          <PaperCard key={weekday} delay={0.03 * idx}>
            <div className="relative z-10 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-serif font-bold">{name}</h3>
                <button
                  onClick={() => {
                    setAddSlotWeekday(weekday);
                    setShowAddSlot(true);
                  }}
                  className="text-[var(--ink-faint)] hover:text-[var(--ink)] p-1 text-xl font-bold"
                  title="Add class"
                >
                  +
                </button>
              </div>

              {daySlots.length > 0 ? (
                <div className="space-y-2">
                  {daySlots.map(slot => {
                    const subject = subjectMap.get(slot.subject_id);
                    if (!subject) return null;
                    return (
                      <motion.div
                        key={slot.id}
                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[var(--grid-line)] border border-transparent hover:border-[var(--grid-line-strong)] transition-all group"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: subject.color }}
                        />
                        <span className="text-body text-sm font-semibold flex-1 truncate">{subject.name}</span>
                        <span className="text-body text-xs text-[var(--ink-faint)]">
                          {formatTime(slot.start_time)}
                          {slot.end_time && ` - ${formatTime(slot.end_time)}`}
                        </span>
                        <button
                          onClick={() => handleDeleteSlot(slot.id)}
                          className="text-[var(--ink-faint)] hover:text-[var(--status-red)] opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
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
                <p className="text-body text-sm text-[var(--ink-faint)] italic">No classes</p>
              )}
            </div>
          </PaperCard>
        ))}
      </div>

      {/* Add Slot Modal */}
      <Modal
        isOpen={showAddSlot}
        onClose={() => setShowAddSlot(false)}
        title={`Add Class — ${WEEKDAY_NAMES[addSlotWeekday]}`}
      >
        <form onSubmit={handleAddSlot} className="space-y-4">
          <div>
            <label className="label-notebook">Subject</label>
            <select
              className="input-notebook"
              value={slotSubject}
              onChange={(e) => setSlotSubject(e.target.value)}
              required
            >
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-notebook">Start Time</label>
              <input
                type="time"
                className="input-notebook"
                value={slotStartTime}
                onChange={(e) => setSlotStartTime(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label-notebook">End Time</label>
              <input
                type="time"
                className="input-notebook"
                value={slotEndTime}
                onChange={(e) => setSlotEndTime(e.target.value)}
              />
            </div>
          </div>
          <Button type="submit" variant="primary" disabled={addingSlot} className="w-full">
            {addingSlot ? '...' : 'Add to Timetable'}
          </Button>
        </form>
      </Modal>

      {/* ── Bulk Import Modal ── */}
      <Modal
        isOpen={showImport}
        onClose={() => { setShowImport(false); resetImport(); }}
        title="📋 Bulk Import Timetable"
      >
        <div className="space-y-4">
          {!parsedSlots ? (
            <>
              <div className="text-body text-sm text-[var(--ink-light)] space-y-2 mb-2">
                <p>1. Copy your raw college timetable (and group number).</p>
                <p>2. Ask ChatGPT with this exact prompt:</p>
                <div className="p-2 bg-[rgba(180,175,168,0.1)] border border-[var(--grid-line)] rounded text-xs font-mono select-all text-[var(--ink-faint)]">
                  "I am in Group [X]. Extract all my classes from the timetable below. Return them strictly as a CSV (comma-separated values) in plain text. DO NOT include headers. DO NOT use markdown tables. Format: Weekday,Subject Name,Start Time,End Time. Do not include any other text."
                </div>
                <p>3. Paste the response below (or upload a classmate's JSON file):</p>
              </div>
              
              <textarea
                value={importText}
                onChange={e => setImportText(e.target.value)}
                className="w-full h-40 input-notebook resize-none text-sm font-mono whitespace-pre"
                placeholder="Monday&#9;Physics&#9;09:00&#9;10:00&#10;Tuesday&#9;Maths&#9;10:00&#9;11:00"
              />

              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => templateFileInputRef.current?.click()}
                >
                  📥 Upload Shared JSON Template
                </Button>
              </div>

              <input
                ref={templateFileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFileTemplateUpload}
              />

              {importError && (
                <p className="text-sm text-[var(--status-red)] bg-[var(--status-red-bg)] p-3 rounded-md text-body">
                  {importError}
                </p>
              )}

              <Button
                variant="primary"
                className="w-full"
                onClick={handleParseText}
              >
                Parse Timetable
              </Button>
            </>
          ) : (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-serif font-bold text-lg">
                      Found {parsedSlots.length} class{parsedSlots.length !== 1 ? 'es' : ''}
                    </p>
                    <p className="text-body text-xs text-[var(--ink-faint)]">
                      Review and remove any that look wrong, then save.
                    </p>
                  </div>
                  <button
                    onClick={() => setParsedSlots(null)}
                    className="text-body text-xs text-[var(--ink-faint)] hover:text-[var(--ink)] underline"
                  >
                    Edit Text
                  </button>
                </div>

                <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                  {parsedSlots.map((slot, i) => (
                    <motion.div
                      key={i}
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-[var(--grid-line)] border border-[var(--grid-line-strong)] group"
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                    >
                      <span className="text-body text-xs font-semibold text-[var(--ink-faint)] w-10 shrink-0">
                        {slot.weekdayName.slice(0, 3)}
                      </span>
                      <span className="text-body text-sm font-semibold flex-1 truncate">{slot.subject}</span>
                      <span className="text-body text-xs text-[var(--ink-faint)] shrink-0">
                        {slot.start_time}–{slot.end_time}
                      </span>
                      <button
                        onClick={() => removeSlot(i)}
                        className="text-[var(--ink-faint)] hover:text-[var(--status-red)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </motion.div>
                  ))}
                </div>

                {importError && (
                  <p className="text-sm text-[var(--status-red)] bg-[var(--status-red-bg)] p-3 rounded-md text-body">
                    {importError}
                  </p>
                )}

                <Button
                  variant="primary"
                  className="w-full"
                  disabled={saving || parsedSlots.length === 0}
                  onClick={handleSaveAll}
                >
                  {saving ? 'Saving...' : `✓ Save All ${parsedSlots.length} Slots`}
                </Button>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </Modal>
    </div>
  );
}
