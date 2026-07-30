'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by waiting until mounted
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-[120px] h-9 bg-[var(--grid-line)] rounded-full animate-pulse" />
    );
  }

  return (
    <div className="flex bg-[rgba(180,175,168,0.15)] p-1 rounded-full border border-[var(--grid-line)] w-fit">
      <button
        type="button"
        className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
          theme === 'light'
            ? 'bg-[var(--cream)] shadow-sm text-[var(--ink)]'
            : 'text-[var(--ink-faint)] hover:text-[var(--ink-light)]'
        }`}
        onClick={() => setTheme('light')}
      >
        Light
      </button>
      <button
        type="button"
        className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
          theme === 'dark'
            ? 'bg-[var(--cream)] shadow-sm text-[var(--ink)]'
            : 'text-[var(--ink-faint)] hover:text-[var(--ink-light)]'
        }`}
        onClick={() => setTheme('dark')}
      >
        Dark
      </button>
      <button
        type="button"
        className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
          theme === 'system'
            ? 'bg-[var(--cream)] shadow-sm text-[var(--ink)]'
            : 'text-[var(--ink-faint)] hover:text-[var(--ink-light)]'
        }`}
        onClick={() => setTheme('system')}
      >
        System
      </button>
    </div>
  );
}
