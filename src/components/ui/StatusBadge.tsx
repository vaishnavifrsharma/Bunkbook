'use client';

import React from 'react';

interface StatusBadgeProps {
  percentage: number;
  targetPct?: number;
  condonationPct?: number;
  label?: string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({
  percentage,
  targetPct = 75,
  condonationPct = 65,
  label,
  size = 'md',
}: StatusBadgeProps) {
  let statusClass: string;
  let statusLabel: string;

  if (percentage >= targetPct) {
    statusClass = 'status-safe';
    statusLabel = label || 'Safe';
  } else if (percentage >= condonationPct) {
    statusClass = 'status-warning';
    statusLabel = label || 'At Risk';
  } else {
    statusClass = 'status-danger';
    statusLabel = label || 'Danger';
  }

  const sizeClass = size === 'sm'
    ? 'text-xs px-2 py-0.5'
    : 'text-sm px-3 py-1';

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium text-hand ${statusClass} ${sizeClass}`}
    >
      {statusLabel}
    </span>
  );
}
