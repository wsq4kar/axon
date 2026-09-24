import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Trash2, Waypoints } from 'lucide-react';
import { useStore } from '../lib/store';
import { Page, Card, Segmented, Toggle, Tag, Empty } from '../components/ui';
import { PRESETS } from '../lib/presets';
import { uid } from '../lib/uri';
import type { RoutingRule } from '../lib/types';

const KINDS = [
  { v: 'domainSuffix', l: 'Домен и поддомены', ph: 'youtube.com' }, { v: 'domain', l: 'Точный домен', ph: 'api.example.com' },
  { v: 'domainKeyword', l: 'Слово в домене', ph: 'google' }, { v: 'geosite', l: 'Категория сайтов', ph: 'category-ru, youtube, openai' },
  { v: 'geoip', l: 'Страна по IP', ph: 'ru, private' }, { v: 'ipCidr', l: 'IP / подсеть', ph: '10.0.0.0/8' },
  { v: 'process', l: 'Приложение', ph: 'Telegram.exe' }, { v: 'port', l: 'Порт', ph: '22, 3389' },
] as const;
const ACTIONS: { value: RoutingRule['action']; label: string }[] = [{ value: 'proxy', label: 'Через VPN' }, { value: 'direct', label: 'Напрямую' }, { value: 'block', label: 'Блокировать' }];

export default function Routing() {
  const s = useStore(); const r = s.routing;
  const [kind, setKind] = React.useState<(typeof KINDS)[number]['v']>('domainSuffix');
  const [value, setValue] = React.useState(''); const [action, setAction] = React.useState<RoutingRule['action']>('proxy');
  const add = () => {
    const vals = value.split(',').map(x => x.trim()).filter(Boolean); if (!vals.length) return;
    s.upsertRule({ id: uid(), enabled: true, action, [kind]: vals } as RoutingRule); setValue('');
  };
  return (
    <Page title="Маршруты" subtitle="Что идёт через VPN, что напрямую, что блокируется. Правила проверяются сверху вниз.">
      <Card className="mb-4 p-4">
        <div className="label mb-2">Режим</div>
        <Segmented value={r.mode} onChange={v => s.setRouting({ ...r, mode: v })} options={[{ value: 'smart', label: 'Всё, кроме России' }, { value: 'global', label: 'Всё через VPN' }, { value: 'rules', label: 'Только правила' }, { value: 'direct', label: 'Напрямую' }]} />
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-[12px] text-fg-3">Готовые наборы:</span>
          {PRESETS.map(p => <button key={p.name} className="btn btn-ghost btn-sm" onClick={() => { s.setRouting({ ...p, rules: [...p.rules] }); s.toast(`Набор «${p.name}»`); }}>{p.name}</button>)}
        </div>
      </Card>
      <Card className="mb-4 p-4">
        <div className="label mb-2">Новое правило</div>
        <div className="flex flex-wrap gap-2">
          <select value={kind} onChange={e => setKind(e.target.value as any)} className="field w-[190px] appearance-none">{KINDS.map(k => <option key={k.v} value={k.v}>{k.l}</option>)}</select>
          <label className="field min-w-[220px] flex-1"><input value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder={KINDS.find(k => k.v === kind)!.ph} /></label>
          <Segmented value={action} onChange={setAction} options={ACTIONS} />
          <button className="btn btn-primary" onClick={add}><Plus size={15} />Добавить</button>
        </div>
      </Card>
      {r.rules.length === 0 ? <Empty icon={<Waypoints size={20} />} title="Своих правил нет" text="Режим работает сам. Добавьте правило, если нужно, чтобы конкретный сайт или программа шли иначе." /> : (
        <div className="grid gap-1.5">
          <AnimatePresence initial={false}>
            {r.rules.map(rule => {
              const conds = KINDS.flatMap(k => ((rule as any)[k.v] || []).map((x: string) => `${k.l.toLowerCase()}: ${x}`));
              return (
                <motion.div key={rule.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <Card className={`flex items-center gap-3 px-3.5 py-2.5 ${rule.enabled ? '' : 'opacity-50'}`}>
                    <Toggle on={rule.enabled} onChange={v => s.upsertRule({ ...rule, enabled: v })} label="Включено" />
                    <Tag inverse={rule.action === 'proxy'}>{ACTIONS.find(a => a.value === rule.action)!.label}</Tag>
                    <div className="flex min-w-0 flex-1 flex-wrap gap-1">{conds.slice(0, 6).map(c => <span key={c} className="rounded-xs border border-line bg-panel px-1.5 py-0.5 font-mono text-[11px] text-fg-2">{c}</span>)}{conds.length > 6 && <span className="text-[11px] text-fg-3">+{conds.length - 6}</span>}</div>
                    {rule.note && <span className="text-[11px] text-fg-3">{rule.note}</span>}
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => s.removeRule(rule.id)} aria-label="Удалить"><Trash2 size={14} /></button>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </Page>
  );
}
