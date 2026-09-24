/* Мост к Rust (Tauri). Вне Tauri (обычный браузер) — демо-режим с правдоподобными
   данными: так интерфейс можно показать и проверить без Windows и ядер. */
import { invoke } from '@tauri-apps/api/core';
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export interface HttpResponse { status: number; headers: Record<string, string>; body: string }

export const backend = {
  async fetchUrl(url: string, userAgent: string): Promise<HttpResponse> {
    if (isTauri) return invoke('fetch_url', { url, userAgent });
    const r = await fetch(url); const headers: Record<string, string> = {};
    r.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
    return { status: r.status, headers, body: await r.text() };
  },
  async startCores(singbox: object, xray: object | null): Promise<void> {
    if (isTauri) return invoke('start_cores', { singbox: JSON.stringify(singbox, null, 2), xray: xray ? JSON.stringify(xray, null, 2) : null });
    await sleep(900);
  },
  async stopCores(): Promise<void> { if (isTauri) return invoke('stop_cores'); await sleep(200); },
  async setSystemProxy(enable: boolean, port: number): Promise<void> { if (isTauri) return invoke('set_system_proxy', { enable, port }); },
  async loadState(): Promise<string | null> {
    if (isTauri) return invoke('load_state');
    try { return localStorage.getItem('axon-state'); } catch { return null; }
  },
  async saveState(json: string): Promise<void> {
    if (isTauri) return invoke('save_state', { json });
    try { localStorage.setItem('axon-state', json); } catch { /* демо */ }
  },
  async tcpPing(host: string, port: number): Promise<number | null> {
    if (isTauri) return invoke('tcp_ping', { host, port, timeoutMs: 3000 });
    await sleep(150 + Math.random() * 500); return Math.random() < 0.1 ? null : Math.round(25 + Math.random() * 180);
  },
  async isElevated(): Promise<boolean> { return isTauri ? invoke('is_elevated') : false; },
  async relaunchAsAdmin(): Promise<void> { if (isTauri) return invoke('relaunch_as_admin'); },
  async openExternal(url: string): Promise<void> { if (isTauri) return invoke('open_external', { url }); window.open(url, '_blank'); },
  async window(action: 'minimize' | 'maximize' | 'hide' | 'quit'): Promise<void> { if (isTauri) return invoke('window_action', { action }); },
  async startupArgs(): Promise<string[]> { return isTauri ? invoke('startup_args') : []; },
  async coreVersions(): Promise<Record<string, string>> {
    if (isTauri) return invoke('core_versions');
    return { 'sing-box': '1.11 (демо)', xray: '25 (демо)', amneziawg: '—' };
  },
  onLog(cb: (line: string) => void): Promise<UnlistenFn> {
    if (isTauri) return listen<string>('core-log', e => cb(e.payload));
    return Promise.resolve(() => {});
  },
  /* Мини-окно — отдельный webview: состояние ему шлёт главное окно, команды идут обратно через tray-action. */
  async broadcast(event: string, payload: unknown): Promise<void> { if (isTauri) await emit(event, payload); },
  onEvent<T>(event: string, cb: (p: T) => void): Promise<UnlistenFn> {
    if (isTauri) return listen<T>(event, e => cb(e.payload));
    return Promise.resolve(() => {});
  },
  onTray(cb: (action: string) => void): Promise<UnlistenFn> {
    if (isTauri) return listen<string>('tray-action', e => cb(e.payload));
    return Promise.resolve(() => {});
  },
};

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
