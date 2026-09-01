import type { ReactNode, ButtonHTMLAttributes } from 'react';
import type { Verdict, RuleStatus } from '@/types/results';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
};

/*
 * Buttons carry no brand colour. The primary action is simply the lightest
 * thing on screen, which is enough of a signal and leaves every hue free to
 * mean something in the results.
 */
const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-ink text-[#101216] hover:bg-white font-semibold',
  secondary: 'bg-raised text-ink border border-line-strong hover:border-[#3d454f]',
  ghost: 'bg-transparent text-muted hover:text-ink hover:bg-surface-2',
  danger: 'bg-transparent text-fail border border-[#3b2523] hover:bg-[#1f1413]',
};

export function Button({ variant = 'primary', className = '', ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={`rounded-[3px] px-3 py-[7px] cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`panel ${className}`}>{children}</div>;
}

/** A ruled section divider. Replaces heading-plus-explanatory-paragraph. */
export function SectionHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 mt-6 mb-2 first:mt-0">
      <div className="label">{title}</div>
      {action}
    </div>
  );
}

const VERDICT_TONE: Record<Verdict, string> = {
  QUALIFIED: 'text-pass border-pass/35',
  WATCH: 'text-watch border-watch/35',
  REJECTED: 'text-fail border-fail/35',
  INSUFFICIENT_DATA: 'text-none border-none/35',
};

export function VerdictPill({ verdict }: { verdict: Verdict }) {
  return (
    <span
      className={`num text-[10px] font-semibold tracking-[0.1em] px-2 py-1 rounded-[2px] border whitespace-nowrap ${VERDICT_TONE[verdict]}`}
    >
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
  PASS: 'pass',
  FAIL: 'fail',
  UNCONFIRMED: 'pending',
  UNKNOWN: 'no data',
};

export function StatusMark({ status }: { status: RuleStatus }) {
  return (
    <span className={`num text-[11px] whitespace-nowrap ${STATUS_TONE[status]}`}>
      {STATUS_TEXT[status]}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="text-faint px-4 py-10 text-center leading-relaxed">{children}</div>;
}

export function Toggle({
  options, value, onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="inline-flex border border-line-strong rounded-[3px] overflow-hidden">
      {options.map((o, index) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 cursor-pointer text-[12px] ${index > 0 ? 'border-l border-line-strong' : ''} ${
            value === o.value ? 'bg-raised text-ink' : 'text-faint hover:text-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
