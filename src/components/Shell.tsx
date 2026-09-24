import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, BarChart3, Cable, Command, Globe2, Home, LifeBuoy, Minus, ScrollText, Search, Server, Settings2, Square, Waypoints, X } from 'lucide-react';
import { useStore, type Page } from '../lib/store';
import { backend } from '../lib/backend';
import { spring } from './ui';

export const NAV: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: 'home', label: 'Главная', icon: <Home size={19} strokeWidth={1.6} /> },
  { id: 'servers', label: 'Серверы', icon: <Server size={19} strokeWidth={1.6} /> },
  { id: 'routing', label: 'Маршруты', icon: <Waypoints size={19} strokeWidth={1.6} /> },
  { id: 'connections', label: 'Соедин.', icon: <Cable size={19} strokeWidth={1.6} /> },
  { id: 'stats', label: 'Трафик', icon: <BarChart3 size={19} strokeWidth={1.6} /> },
  { id: 'logs', label: 'Логи', icon: <ScrollText size={19} strokeWidth={1.6} /> },
  { id: 'diagnostics', label: 'Помощь', icon: <LifeBuoy size={19} strokeWidth={1.6} /> },
];

export function TitleBar() {
  const status = useStore(s => s.status); const setPalette = useStore(s => s.setPalette);
  const label = status === 'on' ? 'Подключено' : status === 'connecting' ? 'Подключение…' : status === 'error' ? 'Ошибка' : 'Отключено';
  return (
    <div className="drag col-span-full flex h-9 items-center gap-3 border-b border-line pl-3">
      <div className="flex items-center gap-2 text-[13px] font-semibold">
        <span className="grid h-[22px] w-[22px] place-items-center rounded-[6px] border border-line-hover bg-surface"><Globe2 size={13} /></span>
        Axon <span className="tag">0.1</span>
      </div>
      <div className="flex flex-1 justify-center">
        <button className="no-drag field field-sm w-[360px] max-w-[42vw]" style={{ height: 26 }} onClick={() => setPalette(true)}>
          <Search size={13} /><span className="flex-1 text-left text-[12px]">Команды, серверы, настройки</span><span className="kbd">Ctrl K</span>
        </button>
      </div>
      <span className="pill pill-sm no-drag"><i className={`dot ${status === 'on' ? 'dot-live m-pulse' : status === 'error' ? 'dot-error' : ''}`} />{label}</span>
      <div className="no-drag flex h-full">
        {[{ a: 'minimize' as const, i: <Minus size={14} /> }, { a: 'maximize' as const, i: <Square size={11} /> }, { a: 'hide' as const, i: <X size={15} /> }].map(b => (
          <button key={b.a} onClick={() => backend.window(b.a)} className="grid h-full w-11 place-items-center text-fg-3 transition-colors hover:bg-surface hover:text-fg" aria-label={b.a}>{b.i}</button>
        ))}
      </div>
    </div>
  );
}

export function Rail() {
  const page = useStore(s => s.page), go = useStore(s => s.go);
  const item = (n: { id: Page; label: string; icon: React.ReactNode }) => (
    <button key={n.id} onClick={() => go(n.id)} className="relative grid w-[54px] justify-items-center gap-1 rounded-md pb-1.5 pt-2 text-[10px] font-medium transition-colors"
      style={{ color: page === n.id ? 'var(--text)' : 'var(--text-3)' }}>
      {page === n.id && <motion.span layoutId="rail-active" transition={spring} className="absolute inset-0 rounded-md border border-line-hover bg-surface shadow-[inset_0_1px_0_var(--highlight)]" />}
      <span className="relative">{n.icon}</span><span className="relative">{n.label}</span>
    </button>
  );
  return (
    <nav className="flex flex-col items-center gap-1 border-r border-line py-2">
      {NAV.map(item)}
      <span className="flex-1" />
      {item({ id: 'settings', label: 'Настройки', icon: <Settings2 size={19} strokeWidth={1.6} /> })}
    </nav>
  );
}

export function Toasts() {
  const toasts = useStore(s => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[80] grid gap-2">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id} layout initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, filter: 'blur(4px)' }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            className="pointer-events-auto flex min-w-[260px] max-w-[420px] items-center gap-3 rounded-lg bg-surface-raised px-4 py-3 text-[13px] shadow-[var(--shadow-2)]">
            <i className={`dot ${t.kind === 'err' ? 'dot-error' : 'dot-live'}`} />{t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function CommandPalette() {
  const open = useStore(s => s.paletteOpen), setPalette = useStore(s => s.setPalette);
  const [q, setQ] = React.useState(''); const [active, setActive] = React.useState(0);
  const st = useStore();
  const cmds = React.useMemo(() => [
    { label: st.status === 'on' ? 'Отключиться' : 'Подключиться', icon: <Activity size={15} />, run: () => st.toggle(), kbd: 'Ctrl Enter' },
    { label: 'Проверить задержку серверов', icon: <Server size={15} />, run: () => { st.go('servers'); st.testLatency(); } },
    { label: 'Вставить подписку из буфера', icon: <Command size={15} />, run: async () => { const t = await navigator.clipboard.readText().catch(() => ''); if (t) st.importText(t); else st.toast('Буфер пуст', 'err'); } },
    ...NAV.map(n => ({ label: `Открыть: ${n.label}`, icon: n.icon, run: () => st.go(n.id) })),
    { label: 'Открыть: Настройки', icon: <Settings2 size={15} />, run: () => st.go('settings') },
    ...st.currentNodes().slice(0, 40).map(n => ({ label: `Сервер: ${n.name}`, icon: <Globe2 size={15} />, run: () => st.select(n.id) })),
  ], [st.status, st.nodes, st.activeSubId]);
  const shown = cmds.filter(c => c.label.toLowerCase().includes(q.toLowerCase()));
  React.useEffect(() => { if (open) { setQ(''); setActive(0); } }, [open]);
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyK') { e.preventDefault(); setPalette(!useStore.getState().paletteOpen); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); useStore.getState().toggle(); }
      if (e.key === 'Escape') setPalette(false);
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  const run = (i: number) => { const c = shown[i]; if (!c) return; setPalette(false); c.run(); };
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-[60] bg-[var(--overlay)] backdrop-blur-[6px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPalette(false)} />
          <motion.div className="fixed left-1/2 top-[14vh] z-[70] w-[560px] max-w-[calc(100vw-32px)] -translate-x-1/2 overflow-hidden rounded-xl bg-surface-raised shadow-[var(--shadow-3)]"
            initial={{ opacity: 0, y: -8, scale: 0.96, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -8, scale: 0.96 }} transition={spring}>
            <div className="flex h-12 items-center gap-2 border-b border-line px-4 text-fg-3"><Search size={16} />
              <input autoFocus value={q} onChange={e => { setQ(e.target.value); setActive(0); }} placeholder="Команда, раздел или сервер…" className="flex-1 bg-transparent text-[14px] text-fg outline-none"
                onKeyDown={e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = shown.length || 1; setActive(a => (a + (e.key === 'ArrowDown' ? 1 : -1) + n) % n); } if (e.key === 'Enter') run(active); }} />
              <span className="kbd">Esc</span></div>
            <div className="scrollbar max-h-[340px] overflow-auto p-1">
              {shown.length ? shown.map((c, i) => (
                <button key={c.label} onMouseEnter={() => setActive(i)} onClick={() => run(i)} className="menu-item" data-active={i === active ? '' : undefined}>
                  <span className="text-fg-3">{c.icon}</span><span className="truncate">{c.label}</span>{'kbd' in c && c.kbd ? <span className="kbd">{c.kbd as string}</span> : null}
                </button>
              )) : <div className="placeholder">Ничего не нашлось</div>}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
