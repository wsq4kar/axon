import * as React from 'react';
import { Maximize2, Power } from 'lucide-react';
import { useStore } from '../lib/store';
import { Constellation } from '../components/Constellation';
import { fmtSpeed, watchTraffic } from '../lib/clash';
import { backend, isTauri } from '../lib/backend';

type Live = { status: 'off' | 'connecting' | 'on' | 'error'; node: string; up: number; down: number };

/* Мини-окно из трея: состояние, кнопка, сервер, скорость.
   В приложении это отдельное окно — ядрами управляет главное, сюда приходит только их состояние. */
export default function Mini() {
  const s = useStore();
  const [live, setLive] = React.useState<Live | null>(null);
  React.useEffect(() => {
    if (!isTauri) { s.load(); return; }
    const un = backend.onEvent<Live>('axon-status', setLive);
    return () => { un.then(f => f()); };
  }, []);
  React.useEffect(() => { if (isTauri || s.status !== 'on') return; return watchTraffic(s.settings.clashApiPort, (u, d) => useStore.getState().pushSpeed(u, d)); }, [s.status]);
  const view: Live = live ?? { status: s.status, node: s.currentNodes().find(n => n.id === s.selectedId)?.name ?? 'Автовыбор', up: s.speed.up, down: s.speed.down };
  const toggle = () => (isTauri ? backend.broadcast('tray-action', 'toggle') : s.toggle());
  return (
    <div className="flex h-full flex-col items-center gap-3 overflow-hidden rounded-xl border border-line-hover bg-bg p-4 text-fg">
      <div className="drag flex w-full items-center"><span className="text-[13px] font-semibold">Axon</span><span className="flex-1" />
        <button className="no-drag btn btn-ghost btn-icon btn-sm" onClick={() => backend.window('maximize')} aria-label="Открыть окно"><Maximize2 size={14} /></button></div>
      <div className="relative grid place-items-center"><Constellation status={view.status} size={170} />
        <button onClick={toggle} className={`absolute grid h-14 w-14 place-items-center rounded-full border transition-colors ${view.status === 'on' ? 'border-transparent bg-inverse text-inverse-fg' : 'border-line-strong bg-surface'}`} aria-label="Подключить или отключить"><Power size={22} /></button></div>
      <div className="text-center"><div className="text-[15px] font-semibold">{view.status === 'on' ? 'Подключено' : view.status === 'connecting' ? 'Подключаемся…' : view.status === 'error' ? 'Ошибка' : 'Отключено'}</div>
        <div className="max-w-[260px] truncate text-[12px] text-fg-3">{view.node}</div></div>
      <div className="num flex gap-4 text-[12px] text-fg-2"><span>↓ {fmtSpeed(view.down)}</span><span>↑ {fmtSpeed(view.up)}</span></div>
    </div>
  );
}
