'use client';

import React from 'react';
import NotebookOpen from '@/components/notebook/NotebookOpen';
import NotebookShell from '@/components/notebook/NotebookShell';
import Navigation from '@/components/ui/Navigation';

export default function SemestersLayout({ children }: { children: React.ReactNode }) {
  return (
    <NotebookOpen>
      <NotebookShell>
        <Navigation />
        <div className="notebook-content-with-sidebar pb-20 md:pb-8">
          {children}
        </div>
      </NotebookShell>
    </NotebookOpen>
  );
}
