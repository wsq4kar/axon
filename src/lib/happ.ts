/* Совместимость с Happ: заголовки подписки и его формат маршрутизации
   (happ://routing/onadd/<base64 JSON>). */
import type { RoutingProfile, RoutingRule, Subscription } from './types';
import { b64decode, uid } from './uri';

const maybeB64 = (v?: string | null) => {
  if (!v) return undefined;
  const m = /^base64:(.+)$/i.exec(v.trim());
  if (!m) return v;
  try { return b64decode(m[1]); } catch { return v; }
};

/** Заголовки ответа подписки → поля Subscription. Ключи заголовков — в нижнем регистре. */
export function applyHeaders(sub: Subscription, h: Record<string, string>): Subscription {
  const out = { ...sub };
  const title = maybeB64(h['profile-title']); if (title) out.name = title;
  const iv = parseFloat(h['profile-update-interval'] || ''); if (iv > 0) out.intervalHours = iv;
  const ui = h['subscription-userinfo'];
  if (ui) {
    const o: Record<string, number> = {};
    for (const part of ui.split(';')) { const [k, v] = part.split('=').map(s => s.trim()); if (k) o[k] = +v || 0; }
    out.userinfo = { upload: o.upload || 0, download: o.download || 0, total: o.total || 0, expire: o.expire || 0 };
  }
  out.announce = maybeB64(h['announce']);
  out.supportUrl = h['support-url'] || undefined;
  out.webPageUrl = h['profile-web-page-url'] || undefined;
  out.hideSettings = h['hide-settings'] === '1' || h['hide-settings'] === 'true';
  if (h['routing']) { const r = parseHappRouting(h['routing']); if (r) out.routing = r; }
  return out;
}

/** Строка вида happ://routing/onadd/<b64> или сам JSON. */
export function parseHappRouting(s: string): RoutingProfile | null {
  let json = s.trim();
  const m = /routing\/(?:onadd|add)\/(.+)$/.exec(json);
  if (m) { try { json = b64decode(m[1]); } catch { return null; } }
  let j: any; try { j = JSON.parse(json); } catch { return null; }
  const rules: RoutingRule[] = [];
  const push = (action: RoutingRule['action'], sites?: string[], ips?: string[]) => {
    const r: RoutingRule = { id: uid(), enabled: true, action, note: 'из подписки (Happ)' };
    for (const e of sites || []) {
      const [kind, val] = e.includes(':') ? [e.slice(0, e.indexOf(':')), e.slice(e.indexOf(':') + 1)] : ['domain', e];
      if (kind === 'geosite') (r.geosite ||= []).push(val);
      else if (kind === 'full') (r.domain ||= []).push(val);
      else if (kind === 'keyword') (r.domainKeyword ||= []).push(val);
      else (r.domainSuffix ||= []).push(val);
    }
    for (const e of ips || []) {
      if (e.startsWith('geoip:')) (r.geoip ||= []).push(e.slice(6)); else (r.ipCidr ||= []).push(e);
    }
    if (r.geosite || r.domain || r.domainKeyword || r.domainSuffix || r.geoip || r.ipCidr) rules.push(r);
  };
  push('block', j.BlockSites, j.BlockIp);
  push('direct', j.DirectSites, j.DirectIp);
  push('proxy', j.ProxySites, j.ProxyIp);
  const global = String(j.GlobalProxy ?? 'true') === 'true';
  return { name: j.Name || 'Маршруты из подписки', mode: global ? 'rules' : 'direct', rules };
}
