/* Обновления: смотрим последний релиз на GitHub и предлагаем скачать установщик.
   Установщик NSIS ставит новую версию поверх, настройки и подписки сохраняются. */
import { backend } from './backend';
import pkg from '../../package.json';

export interface Update { version: string; url: string }
export const REPO = 'wsq4kar/axon';
export const APP_VERSION: string = pkg.version;

const parts = (v: string) => v.replace(/^v/, '').split(/[.-]/).map(x => parseInt(x, 10) || 0);
export function newer(a: string, b: string): boolean {
  const x = parts(a), y = parts(b);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}

export async function checkUpdate(): Promise<Update | null> {
  try {
    const r = await backend.fetchUrl(`https://api.github.com/repos/${REPO}/releases/latest`, `Axon/${APP_VERSION}`);
    if (r.status !== 200) return null;
    const rel = JSON.parse(r.body);
    if (!newer(rel.tag_name, APP_VERSION)) return null;
    const asset = (rel.assets || []).find((a: any) => /setup\.exe$/i.test(a.name));
    return { version: rel.tag_name.replace(/^v/, ''), url: asset?.browser_download_url || rel.html_url };
  } catch { return null; }
}
