import * as React from 'react';
import type { Status } from '../lib/store';

/* Живое созвездие — индикатор подключения.
   off: узлы разлетелись и почти не движутся, серые; connecting: стягиваются, крутятся быстрее;
   on: собраны, белые, центр пульсирует, по рёбрам бегут импульсы. */
export function Constellation({ status, size = 240 }: { status: Status; size?: number }) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const st = React.useRef(status); st.current = status;
  React.useEffect(() => {
    const cv = ref.current!; const ctx = cv.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = cv.height = size * dpr; ctx.scale(dpr, dpr);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const N = 14, c = size / 2;
    const nodes = Array.from({ length: N }, (_, i) => ({ a: (i / N) * Math.PI * 2 + (i % 2) * 0.2, r: 0.55 + (i % 3) * 0.14, s: 0.08 + (i % 5) * 0.03, ph: i * 1.37 }));
    let spread = 1, energy = 0, raf = 0, last = performance.now(), t = 0;
    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const s = st.current;
      const tSpread = s === 'on' ? 0.78 : s === 'connecting' ? 0.62 : 1.05;
      const tEnergy = s === 'on' ? 1 : s === 'connecting' ? 0.7 : 0.12;
      spread += (tSpread - spread) * Math.min(1, dt * 3); energy += (tEnergy - energy) * Math.min(1, dt * 2.5);
      t += dt * (s === 'connecting' ? 2.4 : 1);
      ctx.clearRect(0, 0, size, size);
      const R = size * 0.4 * spread;
      const lum = Math.round(90 + energy * 160);
      const col = (a: number) => `rgba(${lum},${lum},${lum},${a})`;
      const pts = nodes.map(p => { const a = p.a + Math.sin(t * p.s + p.ph) * 0.25 + t * 0.04 * energy; const r = R * p.r + Math.sin(t * 0.7 + p.ph) * 4; return [c + Math.cos(a) * r, c + Math.sin(a) * r]; });
      // рёбра к центру и между соседями
      pts.forEach((p, i) => {
        ctx.strokeStyle = col(0.12 + energy * 0.16); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(p[0], p[1]); ctx.stroke();
        const q = pts[(i + 1) % N], q2 = pts[(i + 3) % N];
        ctx.strokeStyle = col(0.08 + energy * 0.2); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
        if (i % 2 === 0) { ctx.strokeStyle = col(0.04 + energy * 0.08); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q2[0], q2[1]); ctx.stroke(); }
        // импульс, бегущий от центра к узлу
        if (energy > 0.5) { const k = ((t * 0.6 + i * 0.37) % 1); ctx.fillStyle = col(0.9 * (1 - k)); ctx.beginPath(); ctx.arc(c + (p[0] - c) * k, c + (p[1] - c) * k, 1.6, 0, 7); ctx.fill(); }
      });
      pts.forEach((p, i) => { ctx.fillStyle = col(0.5 + energy * 0.5); ctx.beginPath(); ctx.arc(p[0], p[1], i % 3 === 0 ? 3 : 2.2, 0, 7); ctx.fill(); });
      const pulse = 1 + Math.sin(t * 2.2) * 0.14 * energy;
      const g = ctx.createRadialGradient(c, c, 0, c, c, 44 * pulse);
      g.addColorStop(0, col(0.35 * energy + 0.05)); g.addColorStop(1, col(0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, 44 * pulse, 0, 7); ctx.fill();
      ctx.fillStyle = col(1); ctx.beginPath(); ctx.arc(c, c, 5 + energy * 2, 0, 7); ctx.fill();
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size]);
  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden />;
}
