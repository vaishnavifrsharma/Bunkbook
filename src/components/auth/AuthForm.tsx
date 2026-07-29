'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import Button from '@/components/ui/Button';

export default function AuthForm() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (error) throw error;
        setMessage('Check your email for a confirmation link!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen notebook-paper flex items-center justify-center p-4">

      <motion.div
        className="paper-card w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="relative z-10 p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="page-title mb-2">BunkBook</h1>
            <p className="page-subtitle">
              Your attendance diary, one bunk at a time
            </p>
          </div>

          {/* Tab toggle */}
          <div className="flex gap-1 mb-6 p-1 rounded-lg" style={{ background: 'rgba(180,175,168,0.15)' }}>
            <button
              type="button"
              className={`flex-1 py-2 rounded-md font-body text-sm font-semibold transition-all ${
                !isSignUp ? 'bg-[var(--cream)] shadow-sm' : 'text-[var(--ink-faint)]'
              }`}
              onClick={() => setIsSignUp(false)}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`flex-1 py-2 rounded-md font-body text-sm font-semibold transition-all ${
                isSignUp ? 'bg-[var(--cream)] shadow-sm' : 'text-[var(--ink-faint)]'
              }`}
              onClick={() => setIsSignUp(true)}
            >
              Sign Up
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label-notebook">Email</label>
              <input
                type="email"
                className="input-notebook"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label-notebook">Password</label>
              <input
                type="password"
                className="input-notebook"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            {error && (
              <motion.p
                className="text-sm text-[var(--status-red)] bg-[var(--status-red-bg)] p-3 rounded-md text-body"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {error}
              </motion.p>
            )}

            {message && (
              <motion.p
                className="text-sm text-[var(--status-green)] bg-[var(--status-green-bg)] p-3 rounded-md text-body"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {message}
              </motion.p>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              size="lg"
              disabled={loading}
            >
              {loading ? '...' : isSignUp ? 'Create Account' : 'Sign In'}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
