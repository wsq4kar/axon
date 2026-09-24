/* Живые данные из sing-box через его clash_api: скорость, соединения, задержки.
   В демо-режиме — генератор правдоподобных данных. */
import { isTauri } from './backend';

export interface Conn {
  id: string; host: string; process?: string; rule: string; chain: string; network: string;
  upload: number; download: number; start: string;
}

const base = (port: number) => `http://127.0.0.1:${port}`;

export function watchTraffic(port: number, cb: (up: number, down: number) => void): () => void {
  if (!isTauri) {
    let t = 0; const iv = setInterval(() => { t++; const burst = Math.sin(t / 5) * 0.5 + 0.6;
      cb(Math.round(20e3 + Math.random() * 90e3 * burst), Math.round(300e3 + Math.random() * 2.4e6 * burst)); }, 1000);
    return () => clearInterval(iv);
  }
  let ws: WebSocket | null = null, closed = false;
  const open = () => {
    ws = new WebSocket(`ws://127.0.0.1:${port}/traffic`);
    ws.onmessage = e => { try { const j = JSON.parse(e.data); cb(j.up || 0, j.down || 0); } catch { /* */ } };
    ws.onclose = () => { if (!closed) setTimeout(open, 1500); };
  };
  open();
  return () => { closed = true; ws?.close(); };
}

const DEMO_HOSTS = ['www.youtube.com', 'rr3---sn-4g5e6nzl.googlevideo.com', 'api.telegram.org', 'discord.com', 'gateway.discord.gg', 'chatgpt.com', 'github.com', 'api.github.com', 'ya.ru', 'gosuslugi.ru', 'store.steampowered.com', 'i.ytimg.com'];
const DEMO_PROC = ['chrome.exe', 'Telegram.exe', 'Discord.exe', 'steam.exe', 'Code.exe', 'firefox.exe'];

export async function fetchConnections(port: number): Promise<Conn[]> {
  if (!isTauri) {
    return DEMO_HOSTS.map((h, i) => {
      const ru = /\.ru$/.test(h);
      return { id: String(i), host: h, process: DEMO_PROC[i % DEMO_PROC.length], rule: ru ? 'rule_set=geosite-category-ru' : 'final',
        chain: ru ? 'direct' : 'proxy → 1·Netherlands', network: i % 5 === 3 ? 'udp' : 'tcp',
        upload: Math.round(Math.random() * 4e5), download: Math.round(Math.random() * 3e7), start: new Date(Date.now() - i * 37000).toISOString() };
    });
  }
  try {
    const j = await (await fetch(`${base(port)}/connections`)).json();
    return (j.connections || []).map((c: any) => ({
      id: c.id, host: c.metadata?.host || c.metadata?.destinationIP || '?', process: c.metadata?.processPath?.split(/[\\/]/).pop(),
      rule: c.rule + (c.rulePayload ? `=${c.rulePayload}` : ''), chain: (c.chains || []).slice().reverse().join(' → '),
      network: c.metadata?.network || 'tcp', upload: c.upload || 0, download: c.download || 0, start: c.start,
    }));
  } catch { return []; }
}

export async function closeConnection(port: number, id: string) {
  if (isTauri) await fetch(`${base(port)}/connections/${id}`, { method: 'DELETE' }).catch(() => {});
}

export async function delay(port: number, tag: string, url: string): Promise<number | null> {
  if (!isTauri) return null;
  try {
    const r = await fetch(`${base(port)}/proxies/${encodeURIComponent(tag)}/delay?timeout=5000&url=${encodeURIComponent(url)}`);
    const j = await r.json(); return typeof j.delay === 'number' && j.delay > 0 ? j.delay : null;
  } catch { return null; }
}

export async function selectProxy(port: number, tag: string) {
  if (isTauri) await fetch(`${base(port)}/proxies/proxy`, { method: 'PUT', body: JSON.stringify({ name: tag }) }).catch(() => {});
}

export async function apiAlive(port: number): Promise<boolean> {
  if (!isTauri) return true;
  try { return (await fetch(`${base(port)}/version`)).ok; } catch { return false; }
}

export const fmtBytes = (b: number) => {
  if (b < 1024) return `${b} Б`; const u = ['КБ', 'МБ', 'ГБ', 'ТБ']; let i = -1;
  do { b /= 1024; i++; } while (b >= 1024 && i < u.length - 1);
  return `${b.toFixed(b >= 100 ? 0 : 1)} ${u[i]}`;
};
export const fmtSpeed = (b: number) => `${fmtBytes(b)}/с`;
