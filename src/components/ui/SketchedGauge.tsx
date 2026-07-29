'use client';

import React, { useMemo } from 'react';
import { motion } from 'motion/react';

interface SketchedGaugeProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  targetPct?: number;
  condonationPct?: number;
  label?: string;
  showLabel?: boolean;
}

function generateSketchedArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  segments: number = 40,
  jitter: number = 1.2,
): string {
  const points: string[] = [];
  const seed = (cx * 7 + cy * 13) % 100;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = startAngle + (endAngle - startAngle) * t;
    const rad = angle * (Math.PI / 180);

    const jitterX = Math.sin(seed + i * 3.7) * jitter;
    const jitterY = Math.cos(seed + i * 2.3) * jitter;

    const x = cx + (radius + jitterX) * Math.cos(rad);
    const y = cy + (radius + jitterY) * Math.sin(rad);

    if (i === 0) {
      points.push(`M ${x} ${y}`);
    } else {
      points.push(`L ${x} ${y}`);
    }
  }

  return points.join(' ');
}

export default function SketchedGauge({
  percentage,
  size = 120,
  strokeWidth = 8,
  targetPct = 75,
  condonationPct = 65,
  label,
  showLabel = true,
}: SketchedGaugeProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - strokeWidth * 2) / 2 - 4;

  const color = useMemo(() => {
    if (percentage >= targetPct) return 'var(--status-green)';
    if (percentage >= condonationPct) return 'var(--status-yellow)';
    return 'var(--status-red)';
  }, [percentage, targetPct, condonationPct]);

  const bgPath = useMemo(
    () => generateSketchedArc(cx, cy, radius, -225, 45, 50, 0.8),
    [cx, cy, radius]
  );

  const clampedPct = Math.min(100, Math.max(0, percentage));
  const endAngle = -225 + (270 * clampedPct) / 100;
  const fgPath = useMemo(
    () => generateSketchedArc(cx, cy, radius, -225, endAngle, 40, 1.2),
    [cx, cy, radius, endAngle]
  );

  const displayPct = Math.round(percentage * 10) / 10;

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background arc */}
        <path
          d={bgPath}
          fill="none"
          stroke="var(--grid-line-strong)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Foreground arc (animated) */}
        <motion.path
          d={fgPath}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
        />
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="font-serif font-bold tracking-tight text-[var(--ink)]"
          style={{ fontSize: size * 0.22, lineHeight: 1 }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.3 }}
        >
          {displayPct}%
        </motion.span>
        {showLabel && label && (
          <span
            className="text-body font-semibold text-[var(--ink-faint)]"
            style={{
              fontSize: size * 0.09,
              marginTop: 2,
            }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
