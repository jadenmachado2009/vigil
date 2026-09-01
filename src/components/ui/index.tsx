import type { ReactNode, ButtonHTMLAttributes } from 'react';
import type { Verdict, RuleStatus } from '@/types/results';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
};

const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-accent text-[#0a0c0d] hover:brightness-110',
  secondary: 'bg-[#171d23] text-[#dce1e6] border border-line hover:border-[#39434f]',
  ghost: 'bg-transparent text-muted hover:text-ink',
  danger: 'bg-transparent text-danger border border-[#3a2529] hover:bg-[#1d1013]',
};

export function Button({ variant = 'primary', className = '', ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={`rounded-[9px] px-4 py-2.5 font-bold cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function SectionHead({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-3 mt-8 first:mt-0">
      <div>
        <h3 className="text-[19px] font-bold tracking-tight">{title}</h3>
        {hint && <p className="text-muted mt-1 leading-relaxed">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

const VERDICT_STYLE: Record<Verdict, string> = {
  QUALIFIED: 'bg-good/12 text-good',
  WATCH: 'bg-warn/12 text-warn',
  REJECTED: 'bg-danger/12 text-danger',
  INSUFFICIENT_DATA: 'bg-[#8c98a6]/12 text-muted',
};

export function VerdictPill({ verdict }: { verdict: Verdict }) {
  return (
    <span className={`text-[11px] font-black px-2.5 py-1.5 rounded-[7px] whitespace-nowrap ${VERDICT_STYLE[verdict]}`}>
      {verdict.replace('_', ' ')}
    </span>
  );
}

const STATUS_STYLE: Record<RuleStatus, string> = {
  PASS: 'text-good',
  FAIL: 'text-danger',
  UNCONFIRMED: 'text-warn',
  UNKNOWN: 'text-muted',
};

const STATUS_LABEL: Record<RuleStatus, string> = {
  PASS: '✓ PASS',
  FAIL: '✗ FAIL',
  UNCONFIRMED: '◔ UNCONFIRMED',
  UNKNOWN: '? UNKNOWN',
};

export function StatusMark({ status }: { status: RuleStatus }) {
  return <b className={`text-[12px] font-black whitespace-nowrap ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</b>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="text-muted text-center py-14 px-5 leading-relaxed">{children}</div>;
}

export function Toggle({
  options, value, onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="inline-flex gap-1 p-1 rounded-[10px] bg-[#0b0f14] border border-line">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-[7px] text-[12px] font-bold transition cursor-pointer ${
            value === o.value ? 'bg-[#1b222a] text-ink' : 'text-faint hover:text-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
