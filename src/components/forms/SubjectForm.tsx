'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Subject, SubjectType } from '@/lib/types';
import { SUBJECT_COLORS } from '@/lib/types';
import Button from '@/components/ui/Button';

interface SubjectFormProps {
  semesterId: string;
  subject?: Subject | null;
  onSuccess: () => void;
}

export default function SubjectForm({ semesterId, subject, onSuccess }: SubjectFormProps) {
  const [name, setName] = useState(subject?.name || '');
  const [type, setType] = useState<SubjectType>(subject?.type || 'lecture');
  const [targetPct, setTargetPct] = useState(subject?.target_pct ?? 75);
  const [condonationPct, setCondonationPct] = useState(subject?.condonation_pct ?? 65);
  const [color, setColor] = useState(subject?.color || SUBJECT_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const isEditing = !!subject;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const payload = {
        user_id: user.id,
        semester_id: semesterId,
        name: name.trim(),
        type,
        target_pct: targetPct,
        condonation_pct: condonationPct,
        color,
      };

      if (isEditing) {
        const { error } = await supabase
          .from('subjects')
          .update(payload)
          .eq('id', subject.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('subjects').insert(payload);
        if (error) throw error;
      }

      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!subject || !confirm('Delete this subject and all its attendance data?')) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('subjects').delete().eq('id', subject.id);
      if (error) throw error;
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Subject Name */}
      <div>
        <label className="label-notebook">Subject Name</label>
        <input
          type="text"
          className="input-notebook"
          placeholder="e.g., Mathematics III"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      {/* Type */}
      <div>
        <label className="label-notebook">Type</label>
        <select
          className="input-notebook"
          value={type}
          onChange={(e) => setType(e.target.value as SubjectType)}
        >
          <option value="lecture">Lecture</option>
          <option value="lab">Lab</option>
          <option value="tutorial">Tutorial</option>
        </select>
      </div>

      {/* Target & Condonation */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-notebook">Target %</label>
          <input
            type="number"
            className="input-notebook"
            min="0"
            max="100"
            value={targetPct}
            onChange={(e) => setTargetPct(parseInt(e.target.value) || 75)}
          />
        </div>
        <div>
          <label className="label-notebook">Condonation %</label>
          <input
            type="number"
            className="input-notebook"
            min="0"
            max="100"
            value={condonationPct}
            onChange={(e) => setCondonationPct(parseInt(e.target.value) || 65)}
          />
        </div>
      </div>

      {/* Color Picker */}
      <div>
        <label className="label-notebook">Color</label>
        <div className="flex gap-2 flex-wrap">
          {SUBJECT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className="w-8 h-8 rounded-full border-2 transition-transform"
              style={{
                background: c,
                borderColor: color === c ? 'var(--ink)' : 'transparent',
                transform: color === c ? 'scale(1.15)' : 'scale(1)',
              }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm text-[var(--status-red)] bg-[var(--status-red-bg)] p-3 rounded-md text-body">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" variant="primary" disabled={loading || !name.trim()}>
          {loading ? '...' : isEditing ? 'Save Changes' : 'Add Subject'}
        </Button>
        {isEditing && (
          <Button type="button" variant="danger" onClick={handleDelete} disabled={loading}>
            Delete
          </Button>
        )}
      </div>
    </form>
  );
}
