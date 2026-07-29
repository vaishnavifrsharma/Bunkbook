'use client';

import React from 'react';

interface SpiralBindingProps {
  orientation?: 'vertical' | 'horizontal';
  count?: number;
}

export default function SpiralBinding({ orientation = 'vertical', count = 22 }: SpiralBindingProps) {
  const rings = Array.from({ length: count }, (_, i) => i);

  return (
    <>
      {rings.map((i) => (
        <svg
          key={i}
          width={orientation === 'vertical' ? 36 : 16}
          height={orientation === 'vertical' ? 18 : 18}
          viewBox="0 0 36 18"
          fill="none"
          style={{
            transform: orientation === 'horizontal' ? 'rotate(90deg)' : undefined,
            flexShrink: 0,
          }}
        >
          <defs>
            {/* Metallic Wire Multi-stop Gradient */}
            <linearGradient id={`wireMetal-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F3F4F6" />
              <stop offset="20%" stopColor="#9CA3AF" />
              <stop offset="45%" stopColor="#374151" />
              <stop offset="70%" stopColor="#D1D5DB" />
              <stop offset="90%" stopColor="#6B7280" />
              <stop offset="100%" stopColor="#1F2937" />
            </linearGradient>

            {/* Specular Highlight */}
            <linearGradient id={`wireHighlight-${i}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
              <stop offset="40%" stopColor="#F9FAFB" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#9CA3AF" stopOpacity="0" />
            </linearGradient>

            {/* Paper Hole Punchout Inner Shadow */}
            <radialGradient id={`holeDepth-${i}`} cx="50%" cy="50%" r="50%">
              <stop offset="60%" stopColor="#1C1917" />
              <stop offset="100%" stopColor="#57534E" stopOpacity="0.3" />
            </radialGradient>
          </defs>

          {/* Paper Hole Punchout (Dark Hole in Paper) */}
          <rect x="20" y="4" width="5" height="10" rx="2.5" fill={`url(#holeDepth-${i})`} />
          <rect x="20" y="4" width="5" height="10" rx="2.5" stroke="#0C0A09" strokeWidth="0.6" strokeOpacity="0.5" fill="none" />

          {/* Back Loop behind Hole (Depth effect) */}
          <path
            d="M 5 13.5 C 10 16.5, 18 15, 22.5 9"
            stroke="#262626"
            strokeWidth="2.8"
            strokeLinecap="round"
          />

          {/* Realistic Front Metallic Wire Loop */}
          <path
            d="M 5 4.5 C 12 0.5, 33 2, 23 9 C 14 14, 3 11, 5 4.5 Z"
            fill="none"
            stroke={`url(#wireMetal-${i})`}
            strokeWidth="3"
          />

          {/* Specular Highlight Curve on Metal Ring */}
          <path
            d="M 7 4 C 13 1, 30 2.2, 22 7.8"
            fill="none"
            stroke={`url(#wireHighlight-${i})`}
            strokeWidth="1.2"
            strokeLinecap="round"
          />

          {/* Wire Drop Shadow onto Paper */}
          <path
            d="M 6 6 C 13 2, 34 3.5, 24 10.5"
            fill="none"
            stroke="#000000"
            strokeWidth="2"
            strokeOpacity="0.15"
            style={{ filter: 'blur(1px)' }}
          />
        </svg>
      ))}
    </>
  );
}
