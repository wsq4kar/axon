import * as React from 'react';
import { AnimatePresence } from 'framer-motion';
import { useStore } from './lib/store';
import { backend } from './lib/backend';
import { watchTraffic } from './lib/clash';
import { isTauri } from './lib/backend';
import { checkUpdate, type Update } from './lib/update';
import { Download } from 'lucide-react';
import { TitleBar, Rail, Toasts, CommandPalette } from './components/Shell';
import Home from './pages/Home';
import Servers from './pages/Servers';
import Routing from './pages/Routing';
import Connections from './pages/Connections';
import Stats from './pages/Stats';
import Logs from './pages/Logs';
import Diagnostics from './pages/Diagnostics';
import SettingsPage from './pages/Settings';

const PAGES = { home: Home, servers: Servers, routing: Routing, connections: Connections, stats: Stats, logs: Logs, diagnostics: Diagnostics, settings: SettingsPage };

export default function App() {
  const page = useStore(s => s.page), status = useStore(s => s.status), port = useStore(s => s.settings.clashApiPort);
  React.useEffect(() => {
    useStore.getState().load();
    const un1 = backend.onLog(l => useStore.getState().pushLog(l));
    const un2 = backend.onTray(a => { const s = useStore.getState(); if (a === 'toggle') s.toggle(); if (a === 'connect') s.connect(); if (a === 'disconnect') s.disconnect(); });
    // Перезапуск от администратора ради TUN приходит с --connect: сразу подключаемся.
    backend.startupArgs().then(a => { if (a.includes('--connect')) setTimeout(() => useStore.getState().connect(), 600); });
    // Подписки обновляются сами по интервалу, который прислал сервер (или раз в 12 ч).
    const refresh = setInterval(() => {
      const st = useStore.getState();
      for (const sub of st.subs) if (sub.url && Date.now() - (sub.updatedAt || 0) > (sub.intervalHours || 12) * 3600e3) st.updateSubscription(sub.id);
    }, 10 * 60e3);
    // Мини-окно в трее получает состояние отсюда.
    let last = '';
    const unsub = useStore.subscribe(st => {
      const node = st.currentNodes().find(n => n.id === st.selectedId);
      const msg = { status: st.status, node: node?.name ?? 'Автовыбор', up: st.speed.up, down: st.speed.down };
      const key = JSON.stringify(msg); if (key === last) return; last = key;
      backend.broadcast('axon-status', msg);
    });
    return () => { un1.then(f => f()); un2.then(f => f()); clearInterval(refresh); unsub(); };
  }, []);
  const [update, setUpdate] = React.useState<Update | null>(null);
  React.useEffect(() => { if (isTauri) checkUpdate().then(setUpdate); }, []);
  React.useEffect(() => {
    if (status !== 'on') return;
    return watchTraffic(port, (u, d) => useStore.getState().pushSpeed(u, d));
  }, [status, port]);
  const P = PAGES[page];
  return (
    <div className="grid-bg grid h-full grid-cols-[64px_1fr] grid-rows-[36px_1fr] bg-bg text-fg">
      <TitleBar />
      <Rail />
      <main className="min-h-0 p-2 pl-0"><div className="h-full overflow-hidden rounded-xl border border-line bg-[color-mix(in_srgb,var(--bg)_60%,transparent)]">
        <AnimatePresence mode="wait"><P key={page} /></AnimatePresence>
      </div></main>
      <CommandPalette /><Toasts />
      {update && <button onClick={() => backend.openExternal(update.url)} className="pill fixed bottom-4 right-4 z-40 gap-2 bg-inverse text-inverse-fg"><Download size={13} />Обновить до {update.version}</button>}
    </div>
  );
}
