import * as React from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, ChevronRight, Power, Timer } from 'lucide-react';
import { useStore } from '../lib/store';
import { Constellation } from '../components/Constellation';
import { Segmented, Tag, Bars, latencyLabel, enter } from '../components/ui';
import { fmtBytes, fmtSpeed } from '../lib/clash';
import { engineFor } from '../lib/uri';

function Sparkline({ data, k }: { data: { up: number; down: number }[]; k: 'up' | 'down' }) {
  const max = Math.max(1, ...data.map(d => d[k])); const w = 160, h = 34;
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * w},${h - (d[k] / max) * (h - 2) - 1}`).join(' ');
  return <svg width={w} height={h} className="overflow-visible"><polyline points={pts} fill="none" stroke="var(--text-2)" strokeWidth="1.5" strokeLinejoin="round" /></svg>;
}

export default function Home() {
  const s = useStore();
  const nodes = s.currentNodes();
  const node = s.selectedId === 'auto' ? null : nodes.find(n => n.id === s.selectedId);
  const lat = latencyLabel(node?.latency);
  const busy = s.status === 'connecting';
  const [elapsed, setElapsed] = React.useState(0);
  React.useEffect(() => { if (s.status !== 'on' || !s.session.since) return; const iv = setInterval(() => setElapsed(Date.now() - s.session.since!), 1000); return () => clearInterval(iv); }, [s.status, s.session.since]);
  const hms = new Date(elapsed).toISOString().slice(11, 19);
  const statusText = s.status === 'on' ? 'Подключено' : busy ? 'Подключаемся…' : s.status === 'error' ? 'Не получилось подключиться' : 'Отключено';
  return (
    <motion.div className="flex h-full flex-col items-center justify-center gap-5 px-8" {...enter} transition={{ duration: 0.32 }}>
      <div className="relative grid place-items-center">
        <Constellation status={s.status} size={250} />
        <motion.button onClick={() => s.toggle()} whileTap={{ scale: 0.94 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          className={`absolute grid h-[76px] w-[76px] place-items-center rounded-full border transition-colors duration-300 ${s.status === 'on' ? 'border-transparent bg-inverse text-inverse-fg shadow-[0_0_48px_rgba(255,255,255,.22)]' : 'border-line-strong bg-surface text-fg hover:bg-surface-hover'}`}
          aria-label={s.status === 'on' ? 'Отключиться' : 'Подключиться'}>
          <Power size={28} strokeWidth={1.8} className={busy ? 'm-spin' : ''} />
        </motion.button>
      </div>
      <div className="text-center">
        <div className="display" style={{ fontSize: 28 }}>{statusText}</div>
        <div className="mt-1 text-[13px] text-fg-3">{s.status === 'on' ? <span className="num inline-flex items-center gap-1.5"><Timer size={13} />{hms}</span> : s.error || 'Нажмите кнопку или Ctrl + Enter'}</div>
      </div>

      <button onClick={() => s.go('servers')} className="card card-interactive flex w-[420px] max-w-full items-center gap-3 px-4 py-3 text-left">
        <span className="avatar" style={{ width: 28, height: 28 }}>{node ? node.name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 1) || '•' : 'A'}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold">{node ? node.name : 'Автовыбор лучшего сервера'}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-fg-3">{node ? <><Tag>{node.protocol}</Tag>{node.transport && node.transport !== 'tcp' && <Tag>{node.transport}</Tag>}<Tag>{engineFor(node)}</Tag></> : `${nodes.length} серверов · выбирает самый быстрый`}</span></span>
        {node && <span className="flex items-center gap-2 text-[12px] text-fg-2"><Bars n={lat.bars} /><span className="num">{lat.text}</span></span>}
        <ChevronRight size={16} className="text-fg-3" />
      </button>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Segmented value={s.settings.inbound} onChange={v => s.setSettings({ inbound: v })} options={[{ value: 'proxy', label: 'Прокси' }, { value: 'tun', label: 'TUN' }, { value: 'both', label: 'Оба' }]} />
        <Segmented value={s.routing.mode} onChange={v => s.setRouting({ ...s.routing, mode: v })} options={[{ value: 'smart', label: 'Кроме РФ' }, { value: 'global', label: 'Всё' }, { value: 'rules', label: 'Правила' }, { value: 'direct', label: 'Напрямую' }]} />
      </div>

      <div className="grid w-[560px] max-w-full grid-cols-2 gap-2">
        {(['down', 'up'] as const).map(k => (
          <div key={k} className="card flex items-center gap-3 px-4 py-3">
            <span className="grid h-8 w-8 place-items-center rounded-sm border border-line-hover bg-panel text-fg-2">{k === 'down' ? <ArrowDown size={15} /> : <ArrowUp size={15} />}</span>
            <span className="min-w-0 flex-1"><span className="label">{k === 'down' ? 'Загрузка' : 'Отдача'}</span>
              <span className="num block text-[16px] font-semibold">{fmtSpeed(s.speed[k])}</span>
              <span className="num block text-[11px] text-fg-3">за сессию {fmtBytes(s.session[k])}</span></span>
            <Sparkline data={s.history} k={k} />
          </div>
        ))}
      </div>
    </motion.div>
  );
}
