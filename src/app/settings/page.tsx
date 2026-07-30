'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import type { Semester } from '@/lib/types';
import PaperCard from '@/components/ui/PaperCard';
import Button from '@/components/ui/Button';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [semester, setSemester] = useState<Semester | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const restoreFileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();
  const router = useRouter();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: semesters } = await supabase
      .from('semesters').select('*').eq('is_active', true).limit(1);
    setSemester(semesters?.[0] || null);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const exportData = async (formatType: 'json' | 'csv') => {
    setExporting(true);
    setMessage(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [semRes, subRes, slotRes, dayRes, classRes] = await Promise.all([
        supabase.from('semesters').select('*').eq('user_id', user.id),
        supabase.from('subjects').select('*').eq('user_id', user.id),
        supabase.from('timetable_slots').select('*').eq('user_id', user.id),
        supabase.from('day_overrides').select('*').eq('user_id', user.id),
        supabase.from('class_overrides').select('*').eq('user_id', user.id),
      ]);

      const data = {
        exportedAt: new Date().toISOString(),
        semesters: semRes.data,
        subjects: subRes.data,
        timetableSlots: slotRes.data,
        dayOverrides: dayRes.data,
        classOverrides: classRes.data,
      };

      let content: string;
      let filename: string;
      let mimeType: string;

      if (formatType === 'json') {
        content = JSON.stringify(data, null, 2);
        filename = `bunkbook-export-${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
      } else {
        const rows: string[] = [];
        rows.push('table,id,data');

        const addRows = (tableName: string, items: Record<string, unknown>[] | null) => {
          if (!items) return;
          items.forEach(item => {
            rows.push(`${tableName},${(item as { id: string }).id},"${JSON.stringify(item).replace(/"/g, '""')}"`);
          });
        };

        addRows('semesters', semRes.data);
        addRows('subjects', subRes.data);
        addRows('timetable_slots', slotRes.data);
        addRows('day_overrides', dayRes.data);
        addRows('class_overrides', classRes.data);

        content = rows.join('\n');
        filename = `bunkbook-export-${new Date().toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMessage(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);
        if (!data.semesters || !data.subjects) {
          throw new Error('Invalid backup file format.');
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        if (!confirm('Restoring will import all backup records into your account. Continue?')) return;

        setExporting(true);

        if (data.semesters && data.semesters.length > 0) {
          await supabase.from('semesters').upsert(data.semesters);
        }
        if (data.subjects && data.subjects.length > 0) {
          await supabase.from('subjects').upsert(data.subjects);
        }
        if (data.timetableSlots && data.timetableSlots.length > 0) {
          await supabase.from('timetable_slots').upsert(data.timetableSlots);
        }
        if (data.dayOverrides && data.dayOverrides.length > 0) {
          await supabase.from('day_overrides').upsert(data.dayOverrides);
        }
        if (data.classOverrides && data.classOverrides.length > 0) {
          await supabase.from('class_overrides').upsert(data.classOverrides);
        }

        setMessage('✓ Backup restored successfully!');
        fetchData();
      } catch (err: unknown) {
        setMessage('❌ Restore failed: ' + (err instanceof Error ? err.message : 'Invalid JSON'));
      } finally {
        setExporting(false);
      }
    };
    reader.readAsText(file);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.p className="text-hand text-2xl text-[var(--ink-faint)]"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >loading...</motion.p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="page-title mb-6">Settings</h1>

      {/* Active Semester */}
      <PaperCard className="mb-4" delay={0}>
        <div className="relative z-10 p-5">
          <h2 className="text-xl font-serif font-bold mb-3">📚 Active Semester</h2>
          {semester ? (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-body font-semibold text-base">{semester.name}</p>
                <p className="text-body text-sm text-[var(--ink-faint)]">
                  {semester.start_date} → {semester.end_date}
                </p>
              </div>
              <Link href="/semesters">
                <Button size="sm">Manage Semesters</Button>
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <p className="text-body text-sm text-[var(--ink-faint)]">No active semester</p>
              <Link href="/semesters">
                <Button size="sm" variant="primary">Create Semester</Button>
              </Link>
            </div>
          )}
        </div>
      </PaperCard>

      {/* Backup & Data */}
      <PaperCard className="mb-4" delay={0.05}>
        <div className="relative z-10 p-5">
          <h2 className="text-xl font-serif font-bold mb-3">💾 Backup & Restore</h2>
          <p className="text-body text-sm text-[var(--ink-light)] mb-4">
            Save a local backup of all your attendance logs or restore a previous JSON backup file.
          </p>

          {message && (
            <p className="text-sm font-semibold p-3 rounded-md mb-4 bg-[rgba(180,175,168,0.12)] text-[var(--ink)]">
              {message}
            </p>
          )}

          <div className="flex gap-3 flex-wrap">
            <Button onClick={() => exportData('json')} disabled={exporting}>
              📥 Export JSON Backup
            </Button>
            <Button onClick={() => exportData('csv')} disabled={exporting} variant="ghost">
              Export CSV
            </Button>
            <Button onClick={() => restoreFileInputRef.current?.click()} disabled={exporting} variant="secondary">
              📤 Restore JSON Backup
            </Button>
          </div>

          <input
            ref={restoreFileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleRestoreBackup}
          />
        </div>
      </PaperCard>

      {/* Appearance */}
      <PaperCard className="mb-4" delay={0.07}>
        <div className="relative z-10 p-5">
          <h2 className="text-xl font-serif font-bold mb-3">🎨 Appearance</h2>
          <p className="text-body text-sm text-[var(--ink-light)] mb-4">
            Switch between the Light Notebook and Dark Ink themes, or follow your system settings.
          </p>
          <ThemeToggle />
        </div>
      </PaperCard>

      {/* Account */}
      <PaperCard delay={0.1}>
        <div className="relative z-10 p-5">
          <h2 className="text-xl font-serif font-bold mb-3">👤 Account</h2>
          <Button variant="danger" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>
      </PaperCard>
    </div>
  );
}
