'use client';

import React from 'react';
import { motion } from 'motion/react';

interface NotebookShellProps {
  children: React.ReactNode;
}

export default function NotebookShell({ children }: NotebookShellProps) {
  return (
    <div className="notebook-shell notebook-paper relative min-h-screen">
      {/* Floating Animated Pastel & Neon Glow Mesh Orbs */}
      <motion.div
        className="glow-blob glow-blue"
        style={{ top: '8%', right: '12%' }}
        animate={{ y: [0, -25, 0], x: [0, 15, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="glow-blob glow-pink"
        style={{ top: '38%', left: '4%' }}
        animate={{ y: [0, 20, 0], x: [0, -20, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />
      <motion.div
        className="glow-blob glow-sage"
        style={{ bottom: '18%', right: '22%' }}
        animate={{ y: [0, -18, 0], scale: [1, 1.05, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />
      <motion.div
        className="glow-blob glow-lavender"
        style={{ bottom: '8%', left: '18%' }}
        animate={{ y: [0, 22, 0], x: [0, 18, 0], scale: [1, 1.07, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
      />

      {/* Main content container */}
      <div className="notebook-content">
        {children}
      </div>
    </div>
  );
}
