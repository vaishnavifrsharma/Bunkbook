'use client';

import React from 'react';
import { motion } from 'motion/react';

interface PaperCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  delay?: number;
  glowColor?: string;
}

export default function PaperCard({
  children,
  className = '',
  onClick,
  delay = 0,
  glowColor,
}: PaperCardProps) {
  return (
    <motion.div
      className={`paper-card ${className}`}
      onClick={onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      style={{ cursor: onClick ? 'pointer' : undefined }}
    >
      {/* Optional pastel glow behind card */}
      {glowColor && (
        <div
          className="absolute -inset-4 rounded-xl pointer-events-none -z-10"
          style={{
            background: `radial-gradient(ellipse at center, ${glowColor} 0%, transparent 70%)`,
            filter: 'blur(20px)',
            opacity: 0.4,
          }}
        />
      )}
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
}
