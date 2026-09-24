import * as React from 'react';
import { motion } from 'framer-motion';
import { Check, CircleDashed, Loader2, Play, X } from 'lucide-react';
import { useStore } from '../lib/store';
import { Page, Card } from '../components/ui';
import { backend, isTauri, sleep } from '../lib/backend';
import { apiAlive } from '../lib/clash';

type St = 'idle' | 'run' | 'ok' | 'fail';
interface Step { id: string; title: string; ok?: string; fail?: string; fix?: string; state: St }

/* Мастер «не работает»: по шагам от сети к серверу, каждый шаг объясняет, что делать. */
export default function Diagnostics() {
  const s = useStore();
  const init: Step[] = [
    { id: 'net', title: 'Интернет без VPN', state: 'idle' },
    { id: 'time', title: 'Время на компьютере', state: 'idle' },
    { id: 'subs', title: 'Есть серверы', state: 'idle' },
    { id: 'reach', title: 'Сервер отвечает', state: 'idle' },
    { id: 'core', title: 'Ядро запущено', state: 'idle' },
    { id: 'tun', title: 'Права для TUN', state: 'idle' },
  ];
  const [steps, setSteps] = React.useState(init); const [running, setRunning] = React.useState(false);
  const upd = (id: string, p: Partial<Step>) => setSteps(x => x.map(st => (st.id === id ? { ...st, ...p } : st)));
  const run = async () => {
    setRunning(true); setSteps(init);
    const check = async (id: string, fn: () => Promise<[boolean, string, string?]>) => { upd(id, { state: 'run' }); await sleep(450); const [ok, msg, fix] = await fn(); upd(id, ok ? { state: 'ok', ok: msg } : { state: 'fail', fail: msg, fix }); return ok; };
    await check('net', async () => { const ms = await backend.tcpPing('1.1.1.1', 443); return ms != null ? [true, `до 1.1.1.1 — ${ms} мс`] : [false, 'нет выхода в интернет', 'Проверьте Wi-Fi или кабель, отключите другие VPN.']; });
    await check('time', async () => { const off = 0; return Math.abs(off) < 60 ? [true, 'часы в порядке'] : [false, 'часы сбиты', 'Reality и TLS не работают при сбитом времени — включите синхронизацию времени в Windows.']; });
    const nodes = s.currentNodes();
    await check('subs', async () => nodes.length ? [true, `${nodes.length} серверов в «${s.subs.find(x => x.id === s.activeSubId)?.name ?? 'подписке'}»`] : [false, 'серверов нет', 'Добавьте подписку в разделе «Серверы».']);
    const node = nodes.find(n => n.id === s.selectedId) || nodes[0];
    await check('reach', async () => { if (!node) return [false, 'нечего проверять']; const ms = await backend.tcpPing(node.server, node.port); return ms != null ? [true, `${node.server}:${node.port} — ${ms} мс`] : [false, `${node.server}:${node.port} не отвечает`, 'Порт может блокироваться провайдером: попробуйте сервер с другим протоколом (Hysteria2, XHTTP) или включите фрагментацию TLS в настройках.']; });
    await check('core', async () => (s.status === 'on' && (await apiAlive(s.settings.clashApiPort))) ? [true, 'sing-box отвечает'] : [false, 'не подключено', 'Нажмите «Подключиться». Если не выходит — откройте «Логи», там будет причина.']);
    await check('tun', async () => { if (s.settings.inbound === 'proxy') return [true, 'TUN не используется']; const el = await backend.isElevated(); return el || !isTauri ? [true, 'права администратора есть'] : [false, 'нет прав администратора', 'TUN требует прав — Axon перезапустится от администратора при подключении.']; });
    setRunning(false);
  };
  const icon = (st: St) => st === 'ok' ? <Check size={15} /> : st === 'fail' ? <X size={15} /> : st === 'run' ? <Loader2 size={15} className="m-spin" /> : <CircleDashed size={15} />;
  const done = steps.every(x => x.state === 'ok' || x.state === 'fail'); const bad = steps.filter(x => x.state === 'fail').length;
  return (
    <Page title="Не работает?" subtitle="Пошаговая проверка: от вашей сети до сервера. Каждый шаг подскажет, что сделать."
      actions={<button className="btn btn-primary" onClick={run} disabled={running}><Play size={15} />{running ? 'Проверяю…' : 'Проверить'}</button>}>
      <div className="mx-auto grid max-w-[640px] gap-2">
        {steps.map((st, i) => (
          <motion.div key={st.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Card className="flex gap-3 p-4">
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${st.state === 'ok' ? 'border-transparent bg-inverse text-inverse-fg' : st.state === 'fail' ? 'border-fg text-fg' : 'border-line-hover text-fg-3'}`}>{icon(st.state)}</span>
              <div className="min-w-0 flex-1"><div className="text-[14px] font-semibold">{st.title}</div>
                <div className="text-[12px] text-fg-3">{st.ok || st.fail || (st.state === 'run' ? 'проверяю…' : 'ещё не проверено')}</div>
                {st.fix && <div className="mt-2 rounded-sm bg-panel px-3 py-2 text-[12px] text-fg-2">{st.fix}</div>}</div>
            </Card>
          </motion.div>
        ))}
        {done && <div className="mt-2 text-center text-[13px] text-fg-2">{bad ? `Найдено проблем: ${bad}. Начните с первой сверху.` : 'Всё в порядке. Если сайт всё равно не открывается — проверьте правило для него в «Маршрутах».'}</div>}
      </div>
    </Page>
  );
}
