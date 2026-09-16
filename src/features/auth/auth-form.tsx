'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui';
import { AsideSection, AsideList } from '@/components/ui/blank-page';
import { getAccount, resetAccountState, importLocalData } from '@/lib/repository/client';

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
  const [available, setAvailable] = useState(true);

  useEffect(() => { void getAccount().then((a) => setAvailable(a.accountsAvailable)); }, []);

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
    <div className="grid lg:grid-cols-[65fr_35fr] gap-x-16 gap-y-12 items-start">
      <div className="min-w-0 max-w-[620px]">
        <div className="doc">Account · {isSignUp ? 'New' : 'Sign in'}</div>
        <h1 className="ser text-[48px] leading-[1.08] font-light mt-3">
          {isSignUp ? 'Keep your record in one place.' : 'Welcome back.'}
        </h1>
        <p className="text-muted leading-relaxed mt-4 max-w-[52ch]">
          {isSignUp
            ? 'An account holds your strategies, checks, and outcomes on the server, so they follow you to any device.'
            : 'Sign in to open the strategies, journal, and analytics saved to your account.'}
        </p>

        {!available && (
          <div className="border-l-2 border-watch pl-4 mt-7">
            <div className="cap !text-watch">Accounts are not switched on for this site yet</div>
            <p className="text-muted text-[15px] leading-relaxed mt-1.5">
              No database is connected, so accounts cannot be created or opened here. Everything else
              works — your strategies and checks are kept in this browser.
            </p>
          </div>
        )}

        <form onSubmit={submit} className="border-t border-ink mt-8 pt-6 grid sm:grid-cols-2 gap-x-6 gap-y-5">
          {isSignUp && (
            <label className="field-label block sm:col-span-2">
              Name <span className="text-faint font-normal normal-case tracking-normal">optional</span>
              <input className="field mt-1.5" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
          )}
          <label className="field-label block">
            Email
            <input className="field mt-1.5" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
          <label className="field-label block">
            Password
            <input className="field mt-1.5" type="password" required value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignUp ? 'new-password' : 'current-password'} />
            {isSignUp && (
              <span className="block text-faint font-normal text-[12.5px] mt-1.5 normal-case tracking-normal">
                At least 10 characters.
              </span>
            )}
          </label>

          {isSignUp && (
            <label className="flex items-start gap-2.5 text-[15px] text-muted cursor-pointer font-normal sm:col-span-2">
              <input type="checkbox" checked={bringLocal} onChange={(e) => setBringLocal(e.target.checked)}
                className="mt-0.5 accent-[#14130f]" />
              Bring the strategies and analyses saved in this browser with me
            </label>
          )}

          <div className="sm:col-span-2 flex items-center gap-5 flex-wrap">
            <Button type="submit" disabled={busy || !available}>
              {busy ? (status ?? 'Working…') : isSignUp ? 'Create account →' : 'Sign in →'}
            </Button>
            <span className="text-faint text-[14px]">
              {isSignUp ? (
                <>Already have one? <Link href="/sign-in" className="text-ink underline underline-offset-4">Sign in</Link></>
              ) : (
                <>No account? <Link href="/sign-up" className="text-ink underline underline-offset-4">Create one</Link></>
              )}
            </span>
          </div>
          {isSignUp && (
            <p className="text-faint text-[13px] sm:col-span-2 leading-relaxed">
              Creating an account means you accept the{' '}
              <Link href="/terms" className="text-ink underline underline-offset-4">Terms of use</Link>
              {' '}and the{' '}
              <Link href="/privacy" className="text-ink underline underline-offset-4">Privacy</Link> page.
            </p>
          )}
          {error && <p className="text-fail text-[15px] sm:col-span-2">{error}</p>}
        </form>
      </div>

      <aside className="flex flex-col gap-9">
        <AsideSection label="An account keeps">
          <AsideList items={[
            { term: 'Strategies', detail: 'Every version, so old checks stay tied to the rules they were judged by.' },
            { term: 'The journal', detail: 'Each check, its rule findings, charts, and the outcome you recorded.' },
            { term: 'Analytics', detail: 'Built from that record, the same on every device.' },
            { term: 'Portfolio limits', detail: 'Your holdings and the limits they are measured against.' },
          ]} />
        </AsideSection>
        <AsideSection label="Without one">
          <p className="text-muted text-[14px] leading-relaxed">
            Vigil works fully. Your work is held in this browser only — clearing site data or
            switching device leaves it behind.
          </p>
        </AsideSection>
        <AsideSection label="Passwords">
          <p className="text-muted text-[14px] leading-relaxed">
            Stored only as a salted scrypt hash. Nobody, including Vigil, can read them back.
          </p>
        </AsideSection>
      </aside>
    </div>
  );
}
