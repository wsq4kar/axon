import * as React from 'react';
import { Copy, ScrollText, Search, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { Page, Segmented, Empty } from '../components/ui';
import { isTauri } from '../lib/backend';

const DEMO = ['INFO[0000] sing-box started (0.84s)', 'INFO[0001] inbound/mixed[mixed-in]: tcp server started at 127.0.0.1:2080', 'INFO[0002] outbound/vless[1·🇳🇱 Нидерланды · Reality]: outbound connection to www.youtube.com:443',
  'INFO[0002] router: match[3] rule_set=[geosite-category-ru geoip-ru] => direct', 'WARN[0005] outbound/hysteria2[2·🇳🇱 Нидерланды · Hysteria2]: udp relay: timeout', 'INFO[0006] [xray] Xray 25 started', 'ERROR[0009] dns: exchange failed for example.invalid: NXDOMAIN'];

export default function Logs() {
  const logs = useStore(s => s.logs); const [lvl, setLvl] = React.useState<'all' | 'warn' | 'error'>('all'); const [q, setQ] = React.useState('');
  const src = logs.length || isTauri ? logs : DEMO;
  const shown = src.filter(l => (lvl === 'all' || (lvl === 'warn' ? /WARN|ERROR|FATAL/.test(l) : /ERROR|FATAL/.test(l))) && l.toLowerCase().includes(q.toLowerCase()));
  const end = React.useRef<HTMLDivElement>(null); React.useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [shown.length]);
  return (
    <Page title="Логи" subtitle="Вывод ядер sing-box, Xray и AmneziaWG"
      actions={<><Segmented value={lvl} onChange={setLvl} options={[{ value: 'all', label: 'Все' }, { value: 'warn', label: 'Предупр.' }, { value: 'error', label: 'Ошибки' }]} />
        <label className="field field-sm w-[200px]"><Search size={13} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск" /></label>
        <button className="btn btn-secondary btn-icon btn-sm" onClick={() => navigator.clipboard.writeText(shown.join('\n'))} aria-label="Копировать"><Copy size={14} /></button>
        <button className="btn btn-secondary btn-icon btn-sm" onClick={() => useStore.setState({ logs: [] })} aria-label="Очистить"><Trash2 size={14} /></button></>}>
      {!shown.length ? <Empty icon={<ScrollText size={20} />} title="Пусто" text="Логи появятся после подключения." /> : (
        <div className="selectable rounded-lg border border-line bg-sunken p-3 font-mono text-[11.5px] leading-[1.7]">
          {shown.map((l, i) => <div key={i} className={/ERROR|FATAL/.test(l) ? 'text-fg' : /WARN/.test(l) ? 'text-fg-2' : 'text-fg-3'}>{/ERROR|FATAL/.test(l) ? '● ' : '  '}{l}</div>)}
          <div ref={end} />
        </div>
      )}
    </Page>
  );
}
