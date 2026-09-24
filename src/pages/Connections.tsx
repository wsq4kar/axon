import * as React from 'react';
import { Cable, Search, X } from 'lucide-react';
import { useStore } from '../lib/store';
import { Page, Tag, Empty } from '../components/ui';
import { closeConnection, fetchConnections, fmtBytes, type Conn } from '../lib/clash';

export default function Connections() {
  const status = useStore(s => s.status), port = useStore(s => s.settings.clashApiPort);
  const [list, setList] = React.useState<Conn[]>([]); const [q, setQ] = React.useState('');
  React.useEffect(() => {
    if (status !== 'on') { setList([]); return; }
    let alive = true; const tick = async () => { const c = await fetchConnections(port); if (alive) setList(c); };
    tick(); const iv = setInterval(tick, 1500); return () => { alive = false; clearInterval(iv); };
  }, [status, port]);
  const shown = list.filter(c => (c.host + c.process + c.rule + c.chain).toLowerCase().includes(q.toLowerCase()));
  return (
    <Page title="Соединения" subtitle="Что сейчас идёт через Axon — в реальном времени"
      actions={<label className="field field-sm w-[240px]"><Search size={13} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Домен, программа, правило" /></label>}>
      {status !== 'on' ? <Empty icon={<Cable size={20} />} title="Нет подключения" text="Список появится, как только Axon подключится." /> : (
        <div className="overflow-hidden rounded-lg border border-line">
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.3fr)_90px_90px_32px] gap-3 border-b border-line bg-panel px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-fg-3">
            <span>Адрес</span><span>Программа</span><span>Маршрут</span><span className="text-right">Получено</span><span className="text-right">Отправлено</span><span /></div>
          {shown.map(c => (
            <div key={c.id} className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.3fr)_90px_90px_32px] items-center gap-3 border-b border-line px-3 py-2 text-[12px] last:border-b-0 hover:bg-surface">
              <span className="flex min-w-0 items-center gap-2"><Tag>{c.network}</Tag><span className="truncate font-mono">{c.host}</span></span>
              <span className="truncate text-fg-2">{c.process || '—'}</span>
              <span className="truncate text-fg-2" title={c.rule}>{c.chain}</span>
              <span className="num text-right">{fmtBytes(c.download)}</span><span className="num text-right text-fg-2">{fmtBytes(c.upload)}</span>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => closeConnection(port, c.id)} aria-label="Закрыть"><X size={13} /></button>
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}
