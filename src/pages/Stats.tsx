import * as React from 'react';
import { useStore } from '../lib/store';
import { Page, Card } from '../components/ui';
import { fmtBytes, fmtSpeed } from '../lib/clash';

function Chart({ data }: { data: { up: number; down: number }[] }) {
  const w = 900, h = 220, max = Math.max(1, ...data.map(d => Math.max(d.up, d.down)));
  const path = (k: 'up' | 'down') => data.map((d, i) => `${i ? 'L' : 'M'}${(i / (data.length - 1)) * w},${h - (d[k] / max) * (h - 8)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[220px] w-full" preserveAspectRatio="none">
      {[0.25, 0.5, 0.75].map(y => <line key={y} x1="0" x2={w} y1={h * y} y2={h * y} stroke="var(--border)" />)}
      <path d={`${path('down')} L${w},${h} L0,${h} Z`} fill="rgba(255,255,255,.06)" />
      <path d={path('down')} fill="none" stroke="var(--text)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      <path d={path('up')} fill="none" stroke="var(--text-3)" strokeWidth="1.3" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function Stats() {
  const s = useStore();
  const peak = Math.max(...s.history.map(d => d.down));
  const cards = [
    { l: 'Загрузка сейчас', v: fmtSpeed(s.speed.down) }, { l: 'Отдача сейчас', v: fmtSpeed(s.speed.up) },
    { l: 'Получено за сессию', v: fmtBytes(s.session.down) }, { l: 'Пик загрузки', v: fmtSpeed(peak) },
  ];
  return (
    <Page title="Трафик" subtitle="Скорость за последнюю минуту и итоги сессии">
      <div className="mb-3 grid grid-cols-4 gap-2">{cards.map(c => <Card key={c.l} className="p-4"><div className="label">{c.l}</div><div className="num mt-1.5 text-[20px] font-semibold">{c.v}</div></Card>)}</div>
      <Card className="p-4">
        <div className="mb-2 flex items-center gap-4 text-[12px] text-fg-3"><span className="flex items-center gap-1.5"><i className="block h-0.5 w-4 bg-fg" />загрузка</span><span className="flex items-center gap-1.5"><i className="block h-0.5 w-4 border-t border-dashed border-fg-3" />отдача</span><span className="flex-1" /><span className="num">макс. {fmtSpeed(Math.max(1, ...s.history.map(d => Math.max(d.up, d.down))))}</span></div>
        <Chart data={s.history} />
      </Card>
    </Page>
  );
}
