import * as React from 'react';
import { Code2, Search } from 'lucide-react';
import { useStore } from '../lib/store';
import { Page, Card, Row, Toggle, Segmented } from '../components/ui';
import type { Settings } from '../lib/types';
import { backend } from '../lib/backend';

type Def = { k: keyof Settings; label: string; hint?: string; type: 'toggle' | 'text' | 'number' | 'seg'; opts?: { value: string; label: string }[] };
const GROUPS: { title: string; items: Def[] }[] = [
  { title: 'Подключение', items: [
    { k: 'inbound', label: 'Способ', hint: 'Прокси — для браузеров и программ, что его понимают; TUN — весь трафик системы, включая игры', type: 'seg', opts: [{ value: 'proxy', label: 'Прокси' }, { value: 'tun', label: 'TUN' }, { value: 'both', label: 'Оба' }] },
    { k: 'engine', label: 'Ядро', hint: 'Авто: sing-box как маршрутизатор, Xray — для протоколов, которых он не знает', type: 'seg', opts: [{ value: 'auto', label: 'Авто' }, { value: 'sing-box', label: 'sing-box' }, { value: 'xray', label: 'Xray' }] },
    { k: 'mixedPort', label: 'Порт прокси', hint: 'HTTP и SOCKS5 на одном порту', type: 'number' },
    { k: 'allowLan', label: 'Пускать другие устройства сети', hint: 'Телефон или приставка смогут ходить через этот компьютер', type: 'toggle' },
    { k: 'autoSelect', label: 'Автовыбор быстрого сервера', type: 'toggle' },
    { k: 'failover', label: 'Переключаться, если сервер упал', type: 'toggle' },
    { k: 'killSwitch', label: 'Kill switch', hint: 'Блокировать интернет, пока VPN не подключён (TUN)', type: 'toggle' },
    { k: 'autoConnect', label: 'Подключаться при запуске', type: 'toggle' },
    { k: 'launchOnStartup', label: 'Запускать вместе с Windows', type: 'toggle' },
  ] },
  { title: 'DNS', items: [
    { k: 'dnsRemote', label: 'DNS через VPN', hint: 'DoH, DoT (tls://), DoQ (quic://) или UDP', type: 'text' },
    { k: 'dnsDirect', label: 'DNS для прямых соединений', type: 'text' },
    { k: 'fakeIp', label: 'Fake-IP', hint: 'Быстрее открываются сайты, но некоторые программы это не любят', type: 'toggle' },
    { k: 'blockAds', label: 'Блокировать рекламу и трекеры', type: 'toggle' },
    { k: 'ipv6', label: 'IPv6', hint: 'Выключено — меньше риск утечек', type: 'toggle' },
  ] },
  { title: 'Если не подключается', items: [
    { k: 'tlsFragment', label: 'Фрагментация TLS', hint: 'Режет первое сообщение на части — помогает против части блокировок', type: 'toggle' },
    { k: 'mux', label: 'Мультиплексирование', hint: 'Несколько соединений в одном — меньше рукопожатий', type: 'toggle' },
  ] },
  { title: 'TUN', items: [
    { k: 'tunStack', label: 'Сетевой стек', type: 'seg', opts: [{ value: 'mixed', label: 'Mixed' }, { value: 'system', label: 'System' }, { value: 'gvisor', label: 'gVisor' }] },
    { k: 'tunMtu', label: 'MTU', type: 'number' },
    { k: 'strictRoute', label: 'Строгая маршрутизация', hint: 'Не выпускать трафик мимо туннеля', type: 'toggle' },
  ] },
  { title: 'Для экспертов', items: [
    { k: 'latencyUrl', label: 'Адрес проверки задержки', type: 'text' },
    { k: 'subUserAgent', label: 'User-Agent подписок', hint: 'Некоторые панели отдают разный формат по User-Agent', type: 'text' },
    { k: 'clashApiPort', label: 'Порт управления ядром (clash_api)', type: 'number' },
    { k: 'logLevel', label: 'Уровень логов', type: 'seg', opts: [{ value: 'error', label: 'Ошибки' }, { value: 'warn', label: 'Предупр.' }, { value: 'info', label: 'Инфо' }, { value: 'debug', label: 'Отладка' }] },
  ] },
];

export default function SettingsPage() {
  const s = useStore(); const [q, setQ] = React.useState(''); const [showJson, setShowJson] = React.useState(false);
  const [versions, setVersions] = React.useState<Record<string, string>>({});
  React.useEffect(() => { backend.coreVersions().then(setVersions).catch(() => {}); }, []);
  const ctl = (d: Def) => {
    const v = s.settings[d.k] as any;
    if (d.type === 'toggle') return <Toggle on={!!v} onChange={x => s.setSettings({ [d.k]: x } as any)} label={d.label} />;
    if (d.type === 'seg') return <Segmented value={String(v)} options={d.opts!} onChange={x => s.setSettings({ [d.k]: x } as any)} />;
    return <label className="field field-sm w-[260px]"><input value={String(v)} onChange={e => s.setSettings({ [d.k]: d.type === 'number' ? +e.target.value || 0 : e.target.value } as any)} className="font-mono text-[12px]" /></label>;
  };
  const match = (d: Def) => (d.label + (d.hint || '')).toLowerCase().includes(q.toLowerCase());
  return (
    <Page title="Настройки" subtitle="Всё работает с умными значениями по умолчанию — меняйте, только если знаете зачем"
      actions={<><label className="field field-sm w-[240px]"><Search size={13} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Найти настройку" /></label>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowJson(!showJson)}><Code2 size={14} />{showJson ? 'Формы' : 'JSON'}</button></>}>
      {showJson ? (
        <pre className="selectable scrollbar overflow-auto rounded-lg border border-line bg-sunken p-4 font-mono text-[11.5px] leading-relaxed text-fg-2">{JSON.stringify(s.previewConfig(), null, 2)}</pre>
      ) : (
        <div className="grid max-w-[860px] gap-3">
          {GROUPS.map(g => { const items = g.items.filter(match); if (!items.length) return null; return (
            <Card key={g.title} className="px-5 py-2"><div className="label pb-1 pt-3">{g.title}</div>{items.map(d => <Row key={d.k} label={d.label} hint={d.hint}>{ctl(d)}</Row>)}</Card>
          ); })}
          <Card className="px-5 py-4"><div className="label mb-2">Ядра</div>
            <div className="flex flex-wrap gap-2">{Object.entries(versions).map(([k, v]) => <span key={k} className="pill">{k} <b className="font-mono font-medium text-fg">{v}</b></span>)}</div>
            <p className="mt-2 text-[12px] text-fg-3">Ядра и базы правил обновляются сами. Axon — открытый проект под GPL-3.0.</p></Card>
        </div>
      )}
    </Page>
  );
}
