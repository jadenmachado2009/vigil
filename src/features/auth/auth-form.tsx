'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Button, Card } from '@/components/ui';
import { resetAccountState, importLocalData } from '@/lib/repository/client';

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter();
  const isSignUp = mode === 'sign-up';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [bringLocal, setBringLocal] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (isSignUp) {
        setStatus('Creating your account…');
        const response = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name }),
        });
        if (!response.ok) {
          const detail = (await response.json()) as { error?: string };
          setError(detail.error ?? 'Could not create the account.');
          return;
        }
      }

      setStatus('Signing in…');
      const result = await signIn('credentials', { email, password, redirect: false });
      if (!result || result.error) {
        setError(isSignUp ? 'Account created, but sign-in failed. Try signing in.' : 'Email or password is incorrect.');
        return;
      }
      resetAccountState();

      if (isSignUp && bringLocal) {
        setStatus('Moving your local work into the account…');
        try {
          await importLocalData();
        } catch {
          // Import is a convenience; a failure must not block sign-in.
        }
      }

      router.push('/');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  return (
    <div className="max-w-[420px] mx-auto mt-6">
      <Card className="p-7">
        <div className="eyebrow">{isSignUp ? 'Create account' : 'Welcome back'}</div>
        <h1 className="text-[24px] font-bold tracking-[-0.6px] mt-2">
          {isSignUp ? 'Keep your strategies' : 'Sign in'}
        </h1>
        <p className="text-muted mt-2 text-[13px] leading-relaxed">
          {isSignUp
            ? 'An account stores your strategies and analyses on the server instead of in this browser.'
            : 'Your strategies and analyses are waiting.'}
        </p>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
          {isSignUp && (
            <label className="field-label block">
              Name <span className="text-faint font-normal">optional</span>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
          )}
          <label className="field-label block">
            Email
            <input className="field" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
          <label className="field-label block">
            Password
            <input className="field" type="password" required value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignUp ? 'new-password' : 'current-password'} />
            {isSignUp && <span className="block text-faint font-normal text-[11px] mt-1.5">At least 10 characters.</span>}
          </label>

          {isSignUp && (
            <label className="flex items-start gap-2.5 text-[13px] text-muted cursor-pointer font-normal">
              <input type="checkbox" checked={bringLocal} onChange={(e) => setBringLocal(e.target.checked)}
                className="mt-0.5 accent-[#d8ff4f]" />
              Bring the strategies and analyses saved in this browser with me
            </label>
          )}

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? (status ?? 'Working…') : isSignUp ? 'Create account' : 'Sign in'}
          </Button>
          {error && <p className="text-danger text-[13px]">{error}</p>}
        </form>

        <p className="text-faint text-[12px] mt-5">
          {isSignUp ? (
            <>Already have an account? <Link href="/sign-in" className="text-accent">Sign in</Link></>
          ) : (
            <>No account? <Link href="/sign-up" className="text-accent">Create one</Link></>
          )}
        </p>
      </Card>
      <p className="text-[#5a646f] text-[11px] mt-4 text-center leading-relaxed">
        You can keep using StrategyAI without an account — your work stays in this browser only.
      </p>
    </div>
  );
}
