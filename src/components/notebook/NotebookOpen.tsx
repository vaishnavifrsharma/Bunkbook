'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import SpiralBinding from './SpiralBinding';

interface NotebookOpenProps {
  children: React.ReactNode;
}

export default function NotebookOpen({ children }: NotebookOpenProps) {
  // The user requested to remove the starting landing page animation.
  // We simply pass through the children without any animation or delay.
  return <>{children}</>;
}
