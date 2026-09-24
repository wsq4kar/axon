/* Разбор ссылок всех протоколов: vless://, vmess://, trojan://, ss://, hy2://, hysteria2://,
   hysteria://, tuic://, wireguard://, wg://, awg://, ssh://, socks://, http(s)://
   плюс конфиги WireGuard/AmneziaWG в формате .conf. */
import type { Node, Protocol, Transport } from './types';

let seq = 0;
export const uid = () => Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 6);

export function b64decode(s: string): string {
  let t = s.trim().replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  while (t.length % 4) t += '=';
  const bin = atob(t);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
/** base64 для любых символов (btoa понимает только латиницу). */
export function b64encode(s: string): string {
  const bytes = new TextEncoder().encode(s); let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin);
}
const looksB64 = (s: string) => /^[A-Za-z0-9+/_=\-\s]+$/.test(s.trim()) && s.trim().length % 4 !== 1;

const list = (v: string | null) => (v ? v.split(',').map(x => x.trim()).filter(Boolean) : undefined);
const num = (v: string | null | undefined) => (v != null && v !== '' && !isNaN(+v) ? +v : undefined);
const dec = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

function commonTls(n: Node, q: URLSearchParams) {
  const security = q.get('security') || '';
  if (security === 'tls' || security === 'reality' || security === 'xtls') n.tls = true;
  n.sni = q.get('sni') || q.get('peer') || q.get('serverName') || undefined;
  n.alpn = list(q.get('alpn'));
  n.fingerprint = q.get('fp') || undefined;
  if (q.get('allowInsecure') === '1' || q.get('insecure') === '1') n.insecure = true;
  if (security === 'reality') n.reality = { publicKey: q.get('pbk') || '', shortId: q.get('sid') || undefined, spiderX: q.get('spx') || undefined };
}

function commonTransport(n: Node, q: URLSearchParams) {
  const t = (q.get('type') || 'tcp').toLowerCase();
  const map: Record<string, Transport> = { tcp: 'tcp', ws: 'ws', grpc: 'grpc', http: 'http', h2: 'http', httpupgrade: 'httpupgrade', xhttp: 'xhttp', splithttp: 'xhttp', quic: 'quic' };
  n.transport = map[t] || 'tcp';
  n.path = q.get('path') ? dec(q.get('path')!) : undefined;
  n.host = q.get('host') || undefined;
  n.serviceName = q.get('serviceName') || undefined;
  n.mode = q.get('mode') || undefined;
  if (n.transport === 'tcp' && q.get('headerType') === 'http') { n.transport = 'http'; }
}

function base(protocol: Protocol, u: URL, raw: string): Node {
  return {
    id: uid(), protocol, raw,
    name: dec(u.hash.replace(/^#/, '')) || `${u.hostname}:${u.port}`,
    server: u.hostname.replace(/^\[|\]$/g, ''), port: +u.port || 443,
  };
}

function parseVmess(raw: string): Node | null {
  const body = raw.slice('vmess://'.length);
  let j: any;
  try { j = JSON.parse(b64decode(body)); } catch { return null; }
  const n: Node = {
    id: uid(), protocol: 'vmess', raw, name: j.ps || `${j.add}:${j.port}`,
    server: j.add, port: +j.port, uuid: j.id, alterId: +(j.aid || 0), security: j.scy || 'auto',
    tls: j.tls === 'tls', sni: j.sni || undefined, alpn: j.alpn ? String(j.alpn).split(',') : undefined, fingerprint: j.fp || undefined,
    path: j.path || undefined, host: j.host || undefined,
  };
  const net = (j.net || 'tcp').toLowerCase();
  n.transport = (({ tcp: 'tcp', ws: 'ws', grpc: 'grpc', h2: 'http', http: 'http', httpupgrade: 'httpupgrade', xhttp: 'xhttp', splithttp: 'xhttp' } as Record<string, Transport>)[net]) || 'tcp';
  if (n.transport === 'grpc') n.serviceName = j.path || undefined;
  return n;
}

function parseSS(raw: string): Node | null {
  // SIP002: ss://base64(method:password)@host:port#name  или  ss://base64(всё)#name
  let s = raw.slice(5);
  const hashAt = s.indexOf('#');
  const name = hashAt >= 0 ? dec(s.slice(hashAt + 1)) : '';
  if (hashAt >= 0) s = s.slice(0, hashAt);
  const qAt = s.indexOf('?'); const query = qAt >= 0 ? new URLSearchParams(s.slice(qAt + 1)) : null;
  if (qAt >= 0) s = s.slice(0, qAt);
  let method = '', password = '', host = '', port = 0;
  const at = s.lastIndexOf('@');
  if (at >= 0) {
    let userinfo = dec(s.slice(0, at));
    if (!userinfo.includes(':')) { try { userinfo = b64decode(userinfo); } catch { return null; } }
    [method, ...[password]] = [userinfo.slice(0, userinfo.indexOf(':')), userinfo.slice(userinfo.indexOf(':') + 1)];
    const hp = s.slice(at + 1).replace(/\/$/, '');
    const m = /^\[?([^\]]+)\]?:(\d+)$/.exec(hp); if (!m) return null;
    host = m[1]; port = +m[2];
  } else {
    let all: string; try { all = b64decode(s); } catch { return null; }
    const m = /^([^:]+):(.*)@\[?([^\]@]+)\]?:(\d+)$/.exec(all); if (!m) return null;
    [, method, password, host] = m; port = +m[4];
  }
  const n: Node = { id: uid(), protocol: 'shadowsocks', raw, name: name || `${host}:${port}`, server: host, port, method, password };
  const plugin = query?.get('plugin');
  if (plugin && /shadow-tls/.test(plugin)) n.protocol = 'shadowsocks';
  return n;
}

/** .conf WireGuard / AmneziaWG (в том числе 2.0 с S3/S4/I1..I5). */
export function parseWgConf(text: string, name = 'WireGuard'): Node | null {
  const sec: Record<string, Record<string, string>> = {}; let cur = '';
  for (const line of text.split(/\r?\n/)) {
    const l = line.replace(/[#;].*$/, '').trim(); if (!l) continue;
    const h = /^\[(\w+)\]$/.exec(l); if (h) { cur = h[1].toLowerCase(); sec[cur] = sec[cur] || {}; continue; }
    const kv = /^(\w+)\s*=\s*(.+)$/.exec(l); if (kv && cur) sec[cur][kv[1].toLowerCase()] = kv[2].trim();
  }
  const i = sec.interface, p = sec.peer; if (!i || !p || !p.endpoint) return null;
  const ep = /^\[?([^\]]+)\]?:(\d+)$/.exec(p.endpoint); if (!ep) return null;
  const awgKeys = ['jc', 'jmin', 'jmax', 's1', 's2', 's3', 's4', 'h1', 'h2', 'h3', 'h4', 'i1', 'i2', 'i3', 'i4', 'i5'];
  const awg: Record<string, string | number> = {};
  for (const k of awgKeys) if (i[k] != null) awg[k.toUpperCase()] = isNaN(+i[k]) ? i[k] : +i[k];
  const isAwg = Object.keys(awg).length > 0;
  return {
    id: uid(), name, protocol: isAwg ? 'amneziawg' : 'wireguard', server: ep[1], port: +ep[2], raw: text,
    wg: {
      privateKey: i.privatekey, publicKey: p.publickey, preSharedKey: p.presharedkey,
      address: (i.address || '').split(',').map(s => s.trim()).filter(Boolean), mtu: num(i.mtu),
      awg: isAwg ? awg : undefined,
    },
    engine: isAwg ? 'amneziawg' : 'sing-box',
  };
}

export function parseUri(line: string): Node | null {
  const raw = line.trim();
  if (!raw) return null;
  const scheme = raw.slice(0, raw.indexOf('://')).toLowerCase();
  try {
    if (scheme === 'vmess') return parseVmess(raw);
    if (scheme === 'ss') return parseSS(raw);
    const u = new URL(raw.replace(/^(\w+):\/\//, 'http://'));
    const q = u.searchParams;
    const user = dec(u.username), pass = dec(u.password);
    switch (scheme) {
      case 'vless': {
        const n = base('vless', u, raw); n.uuid = user; n.flow = q.get('flow') || undefined;
        commonTls(n, q); commonTransport(n, q);
        if (n.transport === 'xhttp') n.engine = 'xray';
        return n;
      }
      case 'trojan': {
        const n = base('trojan', u, raw); n.password = user; n.tls = q.get('security') !== 'none';
        commonTls(n, q); if (q.get('security') !== 'none') n.tls = true; commonTransport(n, q);
        if (n.transport === 'xhttp') n.engine = 'xray';
        return n;
      }
      case 'hy2': case 'hysteria2': {
        const n = base('hysteria2', u, raw); n.password = pass ? `${user}:${pass}` : user; n.tls = true;
        n.sni = q.get('sni') || undefined; n.insecure = q.get('insecure') === '1';
        n.alpn = list(q.get('alpn'));
        if (q.get('obfs')) n.obfs = { type: q.get('obfs')!, password: q.get('obfs-password') || '' };
        n.ports = q.get('mport') || undefined;
        return n;
      }
      case 'hysteria': {
        const n = base('hysteria', u, raw); n.password = q.get('auth') || user; n.tls = true;
        n.sni = q.get('peer') || q.get('sni') || undefined; n.insecure = q.get('insecure') === '1';
        n.upMbps = num(q.get('upmbps')); n.downMbps = num(q.get('downmbps')); n.alpn = list(q.get('alpn'));
        return n;
      }
      case 'tuic': {
        const n = base('tuic', u, raw); n.uuid = user; n.password = pass; n.tls = true;
        n.sni = q.get('sni') || undefined; n.alpn = list(q.get('alpn')); n.congestion = q.get('congestion_control') || undefined;
        n.insecure = q.get('allow_insecure') === '1' || q.get('insecure') === '1';
        return n;
      }
      case 'wireguard': case 'wg': case 'awg': {
        const n = base(scheme === 'awg' ? 'amneziawg' : 'wireguard', u, raw);
        const awg: Record<string, string | number> = {};
        for (const k of ['jc', 'jmin', 'jmax', 's1', 's2', 's3', 's4', 'h1', 'h2', 'h3', 'h4', 'i1', 'i2', 'i3', 'i4', 'i5']) {
          const v = q.get(k) ?? q.get(k.toUpperCase()); if (v != null) awg[k.toUpperCase()] = isNaN(+v) ? v : +v;
        }
        if (Object.keys(awg).length) n.protocol = 'amneziawg';
        n.wg = {
          privateKey: user || q.get('privatekey') || q.get('secretkey') || '', publicKey: q.get('publickey') || q.get('peer_public_key') || '',
          preSharedKey: q.get('presharedkey') || undefined, address: list(q.get('address') || q.get('ip')) || [],
          mtu: num(q.get('mtu')), reserved: q.get('reserved') ? q.get('reserved')!.split(',').map(Number) : undefined,
          awg: Object.keys(awg).length ? awg : undefined,
        };
        n.engine = n.protocol === 'amneziawg' ? 'amneziawg' : 'sing-box';
        return n;
      }
      case 'ssh': {
        const n = base('ssh', u, raw); n.username = user || 'root'; n.password = pass; if (!u.port) n.port = 22; return n;
      }
      case 'socks': case 'socks5': case 'http': case 'https': {
        const n = base(scheme.startsWith('socks') ? 'socks' : 'http', u, raw);
        n.username = user || undefined; n.password = pass || undefined; if (scheme === 'https') n.tls = true;
        if (!u.port) n.port = scheme.startsWith('socks') ? 1080 : 8080;
        return n;
      }
    }
  } catch { return null; }
  return null;
}

/** Любой текст подписки → список серверов: base64, построчные ссылки, sing-box/Xray JSON, .conf. */
export function parseSubscriptionBody(body: string): Node[] {
  let text = body.trim();
  if (!text) return [];
  if (/^\s*\[Interface\]/im.test(text)) { const n = parseWgConf(text); return n ? [n] : []; }
  if (text.startsWith('{') || text.startsWith('[')) {
    try { return fromJson(JSON.parse(text)); } catch { /* не JSON — идём дальше */ }
  }
  if (/^proxies:/m.test(text)) return fromClashYaml(text);
  if (!text.includes('://') && looksB64(text)) { try { text = b64decode(text); } catch { /* оставляем как есть */ } }
  return text.split(/\r?\n/).map(parseUri).filter((n): n is Node => !!n);
}

/** sing-box (outbounds) или Xray (outbounds с protocol) JSON. */
function fromJson(j: any): Node[] {
  const out: Node[] = [];
  const obs: any[] = Array.isArray(j) ? j : j.outbounds || [];
  for (const o of obs) {
    if (o.type && o.server) {           // sing-box
      const tls = o.tls || {};
      out.push({
        id: uid(), name: o.tag || `${o.server}:${o.server_port}`, protocol: (o.type === 'shadowsocks' ? 'shadowsocks' : o.type) as Protocol,
        server: o.server, port: o.server_port, uuid: o.uuid, password: o.password, method: o.method, flow: o.flow,
        tls: !!tls.enabled, sni: tls.server_name, alpn: tls.alpn, insecure: tls.insecure,
        fingerprint: tls.utls?.fingerprint, reality: tls.reality?.enabled ? { publicKey: tls.reality.public_key, shortId: tls.reality.short_id } : undefined,
        transport: o.transport?.type, path: o.transport?.path, serviceName: o.transport?.service_name,
      });
    } else if (o.protocol && o.settings) { // Xray
      const v = o.settings.vnext?.[0] || o.settings.servers?.[0]; if (!v) continue;
      const user = v.users?.[0] || {}; const ss = o.streamSettings || {};
      const rs = ss.realitySettings, ts = ss.tlsSettings;
      out.push({
        id: uid(), name: o.tag || `${v.address}:${v.port}`, protocol: (o.protocol === 'shadowsocks' ? 'shadowsocks' : o.protocol) as Protocol,
        server: v.address, port: v.port, uuid: user.id, password: v.password || user.password, method: v.method, flow: user.flow,
        tls: ss.security === 'tls' || ss.security === 'reality', sni: rs?.serverName || ts?.serverName, fingerprint: rs?.fingerprint || ts?.fingerprint,
        reality: rs ? { publicKey: rs.publicKey, shortId: rs.shortId } : undefined,
        transport: (ss.network === 'splithttp' ? 'xhttp' : ss.network) as Transport, engine: 'xray',
      });
    }
  }
  return out.filter(n => !['direct', 'block', 'dns', 'selector', 'urltest', 'freedom', 'blackhole'].includes(n.protocol as string));
}

/** Минимальный разбор Clash YAML: блок proxies с однострочными словарями { name: …, type: … }. */
function fromClashYaml(text: string): Node[] {
  const out: Node[] = [];
  const block = text.split(/^proxies:\s*$/m)[1]?.split(/^\S/m)[0] || '';
  for (const m of block.matchAll(/^\s*-\s*\{(.+)\}\s*$/gm)) {
    const o: Record<string, string> = {};
    for (const kv of m[1].matchAll(/([\w-]+):\s*("([^"]*)"|'([^']*)'|[^,}]+)/g)) o[kv[1]] = (kv[3] ?? kv[4] ?? kv[2]).trim();
    const type = o.type === 'ss' ? 'shadowsocks' : o.type;
    out.push({
      id: uid(), name: o.name, protocol: type as Protocol, server: o.server, port: +o.port,
      uuid: o.uuid, password: o.password, method: o.cipher, tls: o.tls === 'true', sni: o.servername || o.sni,
      transport: (o.network as Transport) || 'tcp', flow: o.flow,
    });
  }
  return out.filter(n => n.server && n.port);
}

/** Какое ядро нужно узлу: AmneziaWG — своё; XHTTP — только Xray; остальное — sing-box. */
export function engineFor(n: Node): 'sing-box' | 'xray' | 'amneziawg' {
  if (n.protocol === 'amneziawg') return 'amneziawg';
  if (n.transport === 'xhttp' || n.engine === 'xray') return 'xray';
  return 'sing-box';
}
