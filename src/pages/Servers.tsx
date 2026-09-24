import * as React from 'react';
import { motion } from 'framer-motion';
import { ClipboardPaste, Gauge, Link2, RefreshCw, Search, Server, Sparkles, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { Page, Card, Tag, Bars, latencyLabel, Empty } from '../components/ui';
import { fmtBytes } from '../lib/clash';
import { engineFor } from '../lib/uri';

export default function Servers() {
  const s = useStore(); const [input, setInput] = React.useState(''); const [q, setQ] = React.useState('');
  const nodes = s.currentNodes().filter(n => (n.name + n.protocol + n.server).toLowerCase().includes(q.toLowerCase()));
  const doImport = async (t: string) => { if (!t.trim()) return; await s.importText(t); setInput(''); };
  return (
    <Page title="Серверы" subtitle="Подписки, ссылки и конфиги — все форматы, совместимо с Happ"
      actions={<><button className="btn btn-secondary btn-sm" onClick={() => s.testLatency()} disabled={s.testing}><Gauge size={14} className={s.testing ? 'm-spin' : ''} />Проверить задержку</button></>}>
      <div className="mb-4 flex gap-2">
        <label className="field flex-1"><Link2 size={14} /><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && doImport(input)}
          placeholder="Ссылка подписки, vless://, hy2://, ss://, awg://… или конфиг" /></label>
        <button className="btn btn-secondary" onClick={async () => doImport(await navigator.clipboard.readText().catch(() => ''))}><ClipboardPaste size={15} />Из буфера</button>
        <button className="btn btn-primary" onClick={() => doImport(input)}>Добавить</button>
      </div>

      {s.subs.length > 0 && (
        <div className="mb-5 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2">
          {s.subs.map(sub => {
            const ui = sub.userinfo; const used = ui ? ui.upload + ui.download : 0; const active = s.activeSubId === sub.id;
            return (
              <Card key={sub.id} className={`card-interactive p-3.5 ${active ? 'border-line-strong bg-surface-hover' : ''}`} onClick={() => useStore.setState({ activeSubId: sub.id })}>
                <div className="flex items-center gap-2"><span className="flex-1 truncate text-[14px] font-semibold">{sub.name}</span>
                  {sub.url && <button className="btn btn-ghost btn-icon btn-sm" onClick={e => { e.stopPropagation(); s.updateSubscription(sub.id); }} aria-label="Обновить"><RefreshCw size={14} /></button>}
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={e => { e.stopPropagation(); s.removeSubscription(sub.id); }} aria-label="Удалить"><Trash2 size={14} /></button></div>
                <div className="mt-1 text-[12px] text-fg-3">{s.nodes.filter(n => n.subId === sub.id).length} серверов{sub.intervalHours ? ` · обновление раз в ${sub.intervalHours} ч` : ''}</div>
                {ui && ui.total > 0 && <><div className="meter mt-2.5"><i style={{ ['--value' as string]: Math.min(1, used / ui.total) }} /></div>
                  <div className="num mt-1.5 flex justify-between text-[11px] text-fg-3"><span>{fmtBytes(used)} из {fmtBytes(ui.total)}</span>{ui.expire > 0 && <span>до {new Date(ui.expire * 1000).toLocaleDateString('ru-RU')}</span>}</div></>}
                {sub.announce && <div className="mt-2 rounded-sm bg-panel px-2.5 py-1.5 text-[11px] text-fg-2">{sub.announce}</div>}
                {sub.error && <div className="mt-2 text-[11px] text-fg-2">⚠ {sub.error}</div>}
              </Card>
            );
          })}
        </div>
      )}

      {s.nodes.length === 0 ? (
        <Empty icon={<Server size={20} />} title="Серверов пока нет" text="Вставьте ссылку подписки или ссылки серверов в поле выше. Подойдёт всё, что понимают Happ, v2rayN, Hiddify, Clash и AmneziaVPN." />
      ) : (
        <>
          <div className="mb-2 flex items-center gap-2">
            <label className="field field-sm w-[260px]"><Search size={13} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск по серверам" /></label>
            <span className="flex-1" />
            <button className={`btn btn-sm ${s.selectedId === 'auto' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => s.select('auto')}><Sparkles size={14} />Автовыбор</button>
          </div>
          <div className="grid gap-1">
            {nodes.map((n, i) => {
              const lat = latencyLabel(n.latency); const sel = s.selectedId === n.id;
              return (
                <motion.button key={n.id} layout onClick={() => s.select(n.id)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  className={`flex items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors ${sel ? 'border-line-strong bg-surface-active' : 'border-transparent hover:bg-surface'}`}>
                  <i className={`dot ${sel ? 'dot-live' : ''}`} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{n.name}</span>
                  <span className="hidden gap-1 md:flex"><Tag>{n.protocol}</Tag>{n.transport && n.transport !== 'tcp' && <Tag>{n.transport}</Tag>}{n.reality && <Tag>reality</Tag>}{engineFor(n) !== 'sing-box' && <Tag inverse>{engineFor(n)}</Tag>}</span>
                  <span className="num w-[150px] truncate text-right font-mono text-[11px] text-fg-3">{n.server}:{n.port}</span>
                  <span className="flex w-[96px] items-center justify-end gap-2 text-[12px] text-fg-2"><Bars n={lat.bars} /><span className="num">{lat.text}</span></span>
                </motion.button>
              );
            })}
          </div>
        </>
      )}
    </Page>
  );
}
