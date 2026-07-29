'use client';

import React from 'react';
import { motion } from 'motion/react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export default function Button({
  variant = 'default',
  size = 'md',
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const variantClass = {
    default: 'btn-notebook',
    primary: 'btn-notebook btn-primary',
    secondary: 'btn-notebook bg-[rgba(180,175,168,0.15)] border-[var(--ink-light)]',
    danger: 'btn-notebook btn-danger',
    ghost: 'btn-notebook border-transparent hover:border-[var(--ink-faint)]',
  }[variant];

  const sizeClass = {
    sm: 'text-sm px-3 py-1.5',
    md: '',
    lg: 'text-lg px-6 py-3',
  }[size];

  return (
    <motion.button
      className={`${variantClass} ${sizeClass} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      whileTap={!disabled ? { scale: 0.96 } : undefined}
      disabled={disabled}
      {...(props as React.ComponentPropsWithoutRef<typeof motion.button>)}
    >
      {children}
    </motion.button>
  );
}
