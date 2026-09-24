/* Состояние Axon: подписки, узлы, маршруты, настройки, подключение, живые данные. */
import { create } from 'zustand';
import type { Node, RoutingProfile, RoutingRule, Settings, Subscription } from './types';
import { DEFAULT_SETTINGS } from './types';
import { parseSubscriptionBody, uid, engineFor } from './uri';
import { applyHeaders } from './happ';
import { buildSingbox, tagOf } from './singbox';
import { buildXray } from './xray';
import { PRESETS } from './presets';
import { backend, isTauri, sleep } from './backend';
import { apiAlive, delay, selectProxy } from './clash';
import { DEMO_SUB } from './demo';

export type Page = 'home' | 'servers' | 'routing' | 'connections' | 'stats' | 'logs' | 'diagnostics' | 'settings';
export type Status = 'off' | 'connecting' | 'on' | 'error';
export interface Toast { id: string; text: string; kind?: 'ok' | 'err' }

interface Persisted { subs: Subscription[]; nodes: Node[]; activeSubId: string | null; selectedId: string; routing: RoutingProfile; settings: Settings }

interface State extends Persisted {
  page: Page; status: Status; error: string | null; loaded: boolean;
  logs: string[]; speed: { up: number; down: number }; history: { up: number; down: number }[];
  session: { up: number; down: number; since: number | null };
  paletteOpen: boolean; toasts: Toast[]; testing: boolean;
  go(p: Page): void;
  load(): Promise<void>;
  toast(text: string, kind?: Toast['kind']): void;
  importText(text: string): Promise<number>;
  addSubscription(url: string): Promise<void>;
  updateSubscription(id: string): Promise<void>;
  removeSubscription(id: string): void;
  select(id: string): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  toggle(): Promise<void>;
  testLatency(): Promise<void>;
  setSettings(p: Partial<Settings>): void;
  setRouting(r: RoutingProfile): void;
  upsertRule(r: RoutingRule): void;
  removeRule(id: string): void;
  pushLog(line: string): void;
  pushSpeed(up: number, down: number): void;
  setPalette(v: boolean): void;
  currentNodes(): Node[];
  previewConfig(): object;
}

const persistKeys: (keyof Persisted)[] = ['subs', 'nodes', 'activeSubId', 'selectedId', 'routing', 'settings'];
let saveT: ReturnType<typeof setTimeout> | undefined;

export const useStore = create<State>((set, get) => {
  const persist = () => {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      const s = get(); const o: any = {}; persistKeys.forEach(k => { o[k] = s[k]; });
      backend.saveState(JSON.stringify(o));
    }, 400);
  };
  const patch = (p: Partial<State>) => { set(p); persist(); };

  return {
    subs: [], nodes: [], activeSubId: null, selectedId: 'auto', routing: PRESETS[0], settings: DEFAULT_SETTINGS,
    page: 'home', status: 'off', error: null, loaded: false, logs: [], speed: { up: 0, down: 0 },
    history: Array.from({ length: 60 }, () => ({ up: 0, down: 0 })), session: { up: 0, down: 0, since: null },
    paletteOpen: false, toasts: [], testing: false,

    go: page => set({ page }),
    setPalette: v => set({ paletteOpen: v }),
    toast(text, kind = 'ok') {
      const id = uid(); set(s => ({ toasts: [...s.toasts, { id, text, kind }] }));
      setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 3200);
    },

    async load() {
      const raw = await backend.loadState();
      if (raw) { try { const o = JSON.parse(raw); set({ ...o, settings: { ...DEFAULT_SETTINGS, ...o.settings } }); } catch { /* повреждено — начинаем с нуля */ } }
      if (!isTauri && !get().nodes.length) {           // демо: показываем интерфейс с примерами
        const nodes = parseSubscriptionBody(DEMO_SUB).map(n => ({ ...n, subId: 'demo' }));
        set({ subs: [{ id: 'demo', name: 'Демо-подписка', url: 'https://example.net/sub', intervalHours: 2, updatedAt: Date.now(),
          userinfo: { upload: 3.1e9, download: 41.7e9, total: 200e9, expire: Date.now() / 1000 + 86400 * 23 }, announce: 'Это демо: реальные форматы ссылок, выдуманные серверы' }],
          nodes, activeSubId: 'demo', selectedId: nodes[0].id });
      }
      set({ loaded: true });
      if (get().settings.autoConnect && isTauri) get().connect();
    },

    currentNodes() { const s = get(); return s.activeSubId ? s.nodes.filter(n => n.subId === s.activeSubId) : s.nodes; },

    async importText(text) {
      const t = text.trim();
      if (/^https?:\/\//i.test(t) && !t.includes('\n')) { await get().addSubscription(t); return 1; }
      const nodes = parseSubscriptionBody(t).map(n => ({ ...n, subId: 'manual' }));
      if (!nodes.length) { get().toast('Не нашёл ни одного сервера в тексте', 'err'); return 0; }
      const subs = get().subs.some(s => s.id === 'manual') ? get().subs : [...get().subs, { id: 'manual', name: 'Добавленные вручную', url: '' }];
      patch({ subs, nodes: [...get().nodes, ...nodes], activeSubId: 'manual' });
      get().toast(`Добавлено серверов: ${nodes.length}`); return nodes.length;
    },

    async addSubscription(url) {
      const id = uid();
      patch({ subs: [...get().subs, { id, name: new URL(url).hostname, url }], activeSubId: id });
      await get().updateSubscription(id);
    },

    async updateSubscription(id) {
      const sub = get().subs.find(s => s.id === id); if (!sub?.url) return;
      try {
        const r = await backend.fetchUrl(sub.url, get().settings.subUserAgent);
        if (r.status >= 400) throw new Error(`сервер ответил ${r.status}`);
        const nodes = parseSubscriptionBody(r.body).map(n => ({ ...n, subId: id }));
        if (!nodes.length) throw new Error('в подписке нет серверов');
        const updated = applyHeaders({ ...sub, updatedAt: Date.now(), error: undefined }, r.headers);
        patch({
          subs: get().subs.map(s => (s.id === id ? updated : s)),
          nodes: [...get().nodes.filter(n => n.subId !== id), ...nodes],
          ...(updated.routing ? { routing: updated.routing } : {}),
        });
        get().toast(`«${updated.name}»: ${nodes.length} серверов`);
      } catch (e: any) {
        patch({ subs: get().subs.map(s => (s.id === id ? { ...s, error: String(e.message || e) } : s)) });
        get().toast(`Подписка не обновилась: ${e.message || e}`, 'err');
      }
    },

    removeSubscription(id) {
      const s = get();
      patch({ subs: s.subs.filter(x => x.id !== id), nodes: s.nodes.filter(n => n.subId !== id), activeSubId: s.activeSubId === id ? (s.subs.find(x => x.id !== id)?.id ?? null) : s.activeSubId });
    },

    async select(id) {
      patch({ selectedId: id });
      const s = get();
      if (s.status === 'on') {
        const i = s.currentNodes().findIndex(n => n.id === id);
        await selectProxy(s.settings.clashApiPort, id === 'auto' ? 'auto' : tagOf(s.currentNodes()[i], i));
      }
    },

    previewConfig() {
      const s = get(); return buildSingbox(s.currentNodes(), s.selectedId, s.routing, s.settings).singbox;
    },

    async connect() {
      const s = get(); if (s.status === 'connecting') return;
      const nodes = s.currentNodes();
      if (!nodes.length) { get().toast('Сначала добавьте подписку или сервер', 'err'); get().go('servers'); return; }
      const sel = nodes.find(n => n.id === s.selectedId);
      if (sel && engineFor(sel) === 'amneziawg') { get().toast('AmneziaWG подключается отдельным ядром — оно в ближайшей сборке', 'err'); return; }
      if (s.settings.inbound !== 'proxy' && !(await backend.isElevated())) {
        if (isTauri) { get().toast('Для TUN нужны права администратора — перезапускаю', 'err'); await sleep(900); await backend.relaunchAsAdmin(); return; }
      }
      set({ status: 'connecting', error: null });
      try {
        const { singbox, xrayNodes } = buildSingbox(nodes, s.selectedId, s.routing, s.settings);
        await backend.startCores(singbox, xrayNodes.length ? buildXray(xrayNodes, s.settings.logLevel) : null);
        let alive = false;
        for (let i = 0; i < 25 && !alive; i++) { alive = await apiAlive(s.settings.clashApiPort); if (!alive) await sleep(200); }
        if (!alive) throw new Error('ядро не ответило — смотрите «Логи»');
        if (s.settings.inbound !== 'tun') await backend.setSystemProxy(true, s.settings.mixedPort);
        set({ status: 'on', session: { up: 0, down: 0, since: Date.now() } });
      } catch (e: any) {
        await backend.stopCores().catch(() => {});
        set({ status: 'error', error: String(e.message || e) });
        get().toast(`Не подключилось: ${e.message || e}`, 'err');
      }
    },

    async disconnect() {
      await backend.setSystemProxy(false, get().settings.mixedPort).catch(() => {});
      await backend.stopCores().catch(() => {});
      set({ status: 'off', speed: { up: 0, down: 0 } });
    },
    async toggle() { const st = get().status; if (st === 'on' || st === 'connecting') await get().disconnect(); else await get().connect(); },

    async testLatency() {
      const s = get(); if (s.testing) return; set({ testing: true });
      const nodes = s.currentNodes();
      const results = await Promise.all(nodes.map(async (n, i) => {
        let ms: number | null = null;
        if (s.status === 'on') ms = await delay(s.settings.clashApiPort, tagOf(n, i), s.settings.latencyUrl);
        if (ms == null) ms = await backend.tcpPing(n.server, n.port);
        return [n.id, ms] as const;
      }));
      const map = new Map(results);
      patch({ nodes: get().nodes.map(n => (map.has(n.id) ? { ...n, latency: map.get(n.id)! } : n)), testing: false });
      if (s.settings.autoSelect && s.selectedId === 'auto') { /* выбор делает urltest внутри sing-box */ }
    },

    setSettings(p) { patch({ settings: { ...get().settings, ...p } }); },
    setRouting(r) { patch({ routing: r }); },
    upsertRule(r) {
      const rt = get().routing; const has = rt.rules.some(x => x.id === r.id);
      patch({ routing: { ...rt, rules: has ? rt.rules.map(x => (x.id === r.id ? r : x)) : [...rt.rules, r] } });
    },
    removeRule(id) { const rt = get().routing; patch({ routing: { ...rt, rules: rt.rules.filter(r => r.id !== id) } }); },
    pushLog(line) { set(s => ({ logs: [...s.logs.slice(-1999), line] })); },
    pushSpeed(up, down) {
      set(s => ({ speed: { up, down }, history: [...s.history.slice(1), { up, down }],
        session: { ...s.session, up: s.session.up + up, down: s.session.down + down } }));
    },
  };
});
