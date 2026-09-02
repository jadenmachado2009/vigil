'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Mode } from '@/types/rules';

const KEY = 'vigil.mode';

interface ModeContextValue {
  mode: Mode;
  setMode: (mode: Mode) => void;
}

const ModeContext = createContext<ModeContextValue>({ mode: 'trading', setMode: () => {} });

/**
 * Which half of the instrument is in view.
 *
 * One setting shared by the whole app rather than a tab that only the Analyze
 * screen knows about — the dashboard, the strategy library and the checker all
 * answer to it, which is what makes the two modes legible as equals.
 */
export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>('trading');

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(KEY);
      if (stored === 'trading' || stored === 'investing') setModeState(stored);
    } catch {
      // Private browsing or blocked storage. The default stands.
    }
  }, []);

  const setMode = useCallback((next: Mode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Not worth surfacing; the choice simply will not persist.
    }
  }, []);

  return <ModeContext.Provider value={{ mode, setMode }}>{children}</ModeContext.Provider>;
}

export function useMode(): ModeContextValue {
  return useContext(ModeContext);
}

/** Wording that differs between the two halves. */
export const MODE_COPY = {
  trading: {
    noun: 'setup',
    plural: 'setups',
    subject: 'opportunities checked',
    cta: 'Analyze opportunity',
    unit: 'rules',
  },
  investing: {
    noun: 'company',
    plural: 'companies',
    subject: 'companies evaluated',
    cta: 'Analyze company',
    unit: 'criteria',
  },
} as const;
