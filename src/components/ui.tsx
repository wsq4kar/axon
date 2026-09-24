import * as React from 'react';
import { motion } from 'framer-motion';

export const spring = { type: 'spring', stiffness: 380, damping: 30 } as const;
export const enter = { initial: { opacity: 0, y: 8, filter: 'blur(6px)' }, animate: { opacity: 1, y: 0, filter: 'blur(0px)' }, exit: { opacity: 0, y: -4, filter: 'blur(4px)' } };

export function Page({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <motion.div className="flex h-full min-h-0 flex-col" {...enter} transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}>
      <div className="flex items-end gap-4 px-7 pb-4 pt-6">
        <div className="min-w-0 flex-1"><h1 className="h1">{title}</h1>{subtitle && <p className="mt-1 text-[13px] text-fg-3">{subtitle}</p>}</div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="scrollbar min-h-0 flex-1 overflow-auto px-7 pb-7">{children}</div>
    </motion.div>
  );
}

export function Card({ className = '', children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`card ${className}`} {...rest}>{children}</div>;
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" onClick={() => onChange(!on)} />;
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="relative inline-flex gap-0.5 rounded-md border border-line bg-panel p-[3px]">
      {options.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={`relative z-[1] h-7 rounded-sm px-3 text-[13px] font-medium transition-colors ${o.value === value ? 'text-fg' : 'text-fg-3 hover:text-fg-2'}`}>
          {o.value === value && <motion.span layoutId={`seg-${options.map(x => x.value).join()}`} transition={spring}
            className="absolute inset-0 -z-[1] rounded-sm bg-surface-active shadow-[inset_0_1px_0_var(--highlight),0_0_0_1px_var(--border)]" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tag({ children, inverse }: { children: React.ReactNode; inverse?: boolean }) {
  return <span className={`tag ${inverse ? 'tag-inverse' : ''}`}>{children}</span>;
}

export function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-6 border-t border-line py-3.5 first:border-t-0">
      <div className="min-w-0 flex-1"><div className="text-[13px] font-medium">{label}</div>{hint && <div className="mt-0.5 text-[12px] leading-snug text-fg-3">{hint}</div>}</div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

export function Empty({ icon, title, text, children }: { icon: React.ReactNode; title: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="grid place-items-center gap-3 py-16 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-lg border border-line-hover bg-panel text-fg-2">{icon}</div>
      <div className="h2">{title}</div>{text && <p className="max-w-sm text-[13px] text-fg-3">{text}</p>}{children}
    </div>
  );
}

export function latencyLabel(ms?: number | null) {
  if (ms === undefined) return { text: '—', bars: 0 };
  if (ms === null) return { text: 'нет ответа', bars: 0 };
  return { text: `${ms} мс`, bars: ms < 80 ? 3 : ms < 200 ? 2 : 1 };
}

export function Bars({ n }: { n: number }) {
  return <span className="inline-flex items-end gap-[2px]" aria-hidden>{[1, 2, 3].map(i => <i key={i} className="block w-[3px] rounded-sm" style={{ height: 4 + i * 3, background: i <= n ? 'var(--text)' : 'var(--gray-400)' }} />)}</span>;
}
