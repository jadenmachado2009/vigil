'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface Command {
  id: string;
  label: string;
  group: string;
  hint?: string;
  run: () => void;
}

/**
 * Command palette, opened with ⌘K or Ctrl-K.
 *
 * Every destination and action is reachable from the keyboard without learning
 * the layout first. This is the difference between a screen you click around
 * and a tool you drive.
 */
export function CommandPalette({ commands }: { commands: Command[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((v) => !v);
        setQuery('');
        setCursor(0);
      }
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.group} ${c.label}`.toLowerCase().includes(q));
  }, [commands, query]);

  const run = useCallback((command: Command | undefined) => {
    if (!command) return;
    setOpen(false);
    command.run();
  }, []);

  if (!open) return null;

  let lastGroup = '';
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-[14vh] px-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-[520px] bg-surface border border-line-strong rounded-[4px] overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, matches.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
            if (e.key === 'Enter') { e.preventDefault(); run(matches[cursor]); }
          }}
          placeholder="Go to, or run…"
          aria-label="Command palette"
          className="w-full bg-transparent border-0 border-b border-line px-4 py-3 text-ink outline-none placeholder:text-dim"
        />
        <div className="max-h-[46vh] overflow-y-auto py-1">
          {matches.length === 0 && (
            <div className="px-4 py-6 text-faint text-center">Nothing matches.</div>
          )}
          {matches.map((command, index) => {
            const showGroup = command.group !== lastGroup;
            lastGroup = command.group;
            return (
              <div key={command.id}>
                {showGroup && <div className="label px-4 pt-3 pb-1.5">{command.group}</div>}
                <button
                  type="button"
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => run(command)}
                  className={`w-full text-left px-4 py-2 flex items-center justify-between gap-3 cursor-pointer ${
                    index === cursor ? 'bg-raised text-ink' : 'text-muted'
                  }`}
                >
                  <span>{command.label}</span>
                  {command.hint && <span className="num text-[11px] text-dim">{command.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="border-t border-line px-4 py-2 flex gap-4 text-[11px] text-dim">
          <span><span className="kbd">↑↓</span> move</span>
          <span><span className="kbd">↵</span> open</span>
          <span><span className="kbd">esc</span> close</span>
        </div>
      </div>
    </div>
  );
}

/** Sequential shortcuts: press g then s. Standard in tools people use daily. */
export function useGoToShortcuts(map: Record<string, string>) {
  const router = useRouter();
  useEffect(() => {
    let armed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'g') {
        armed = true;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => { armed = false; }, 1200);
        return;
      }
      if (armed && map[event.key]) {
        event.preventDefault();
        armed = false;
        router.push(map[event.key] as string);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [map, router]);
}
