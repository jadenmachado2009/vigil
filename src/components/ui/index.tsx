import type { ReactNode, ButtonHTMLAttributes } from 'react';
import type { Verdict, RuleStatus } from '@/types/results';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
};

/* Ink and paper. No radius, no fill except the primary action's inversion. */
const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-ink text-paper hover:bg-black',
  secondary: 'border border-ink text-ink hover:bg-paper-2',
  ghost: 'text-muted hover:text-ink',
  danger: 'border border-fail/40 text-fail hover:bg-fail/5',
};

export function Button({ variant = 'primary', className = '', ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={`px-4 py-2 cursor-pointer transition-colors uppercase tracking-[0.18em] text-[9.5px] disabled:opacity-40 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    />
  );
}

/** A ruled block, not a card. Top rule only. */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`border-t border-ink ${className}`}>{children}</div>;
}

export function SectionHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 mt-8 mb-2 first:mt-0">
      <div className="cap">{title}</div>
      {action}
    </div>
  );
}

const VERDICT_TONE: Record<Verdict, string> = {
  QUALIFIED: 'text-pass border-pass/40',
  WATCH: 'text-watch border-watch/40',
  REJECTED: 'text-fail border-fail/40',
  INSUFFICIENT_DATA: 'text-none border-none/40',
};

export function VerdictPill({ verdict }: { verdict: Verdict }) {
  return (
    <span className={`cap border px-2.5 py-1 whitespace-nowrap ${VERDICT_TONE[verdict]}`}>
      {verdict.replace('_', ' ')}
    </span>
  );
}

const STATUS_TONE: Record<RuleStatus, string> = {
  PASS: 'text-pass',
  FAIL: 'text-fail',
  UNCONFIRMED: 'text-watch',
  UNKNOWN: 'text-none',
};

const STATUS_TEXT: Record<RuleStatus, string> = {
  PASS: 'Pass',
  FAIL: 'Fail',
  UNCONFIRMED: 'Pending',
  UNKNOWN: 'No data',
};

export function StatusMark({ status }: { status: RuleStatus }) {
  return <span className={`cap whitespace-nowrap ${STATUS_TONE[status]}`}>{STATUS_TEXT[status]}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="text-faint py-12 leading-relaxed">{children}</div>;
}

export function Toggle({
  options, value, onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="inline-flex gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`cap px-3 py-1.5 cursor-pointer border ${
            value === o.value ? 'bg-ink text-paper border-ink !text-paper' : 'border-rule hover:border-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
