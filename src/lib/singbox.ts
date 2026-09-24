/* Сборка конфига sing-box 1.11: он — главный маршрутизатор Axon (прокси + TUN, DNS, правила,
   статистика через clash_api). Узлы, которым нужен Xray (XHTTP), подключаются как socks
   к локальному Xray; AmneziaWG идёт отдельным туннелем и сюда не попадает. */
import type { Node, RoutingProfile, RoutingRule, Settings } from './types';
import { engineFor } from './uri';

export const XRAY_BASE_PORT = 10800;
const GEOSITE = (n: string) => `https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-${n}.srs`;
const GEOIP = (n: string) => `https://raw.githubusercontent.com/SagerNet/sing-geoip/rule-set/geoip-${n}.srs`;

export const tagOf = (n: Node, i: number) => `${i + 1}·${n.name}`.slice(0, 60);

function tls(n: Node) {
  if (!n.tls) return undefined;
  const t: any = { enabled: true };
  if (n.sni) t.server_name = n.sni;
  if (n.insecure) t.insecure = true;
  if (n.alpn?.length) t.alpn = n.alpn;
  if (n.fingerprint || n.reality) t.utls = { enabled: true, fingerprint: n.fingerprint || 'chrome' };
  if (n.reality) t.reality = { enabled: true, public_key: n.reality.publicKey, short_id: n.reality.shortId || '' };
  return t;
}

function transport(n: Node) {
  switch (n.transport) {
    case 'ws': return { type: 'ws', path: n.path || '/', ...(n.host ? { headers: { Host: n.host } } : {}) };
    case 'grpc': return { type: 'grpc', service_name: n.serviceName || '' };
    case 'http': return { type: 'http', ...(n.host ? { host: [n.host] } : {}), path: n.path || '/' };
    case 'httpupgrade': return { type: 'httpupgrade', host: n.host || '', path: n.path || '/' };
    case 'quic': return { type: 'quic' };
    default: return undefined;
  }
}

/** Узел → outbound sing-box (или endpoint для WireGuard). null — sing-box его не умеет. */
export function toOutbound(n: Node, tag: string, s: Settings, xrayPort?: number): any | null {
  const base = { tag, server: n.server, server_port: n.port };
  if (xrayPort) return { type: 'socks', tag, server: '127.0.0.1', server_port: xrayPort, version: '5' };
  const mux = s.mux && !n.flow ? { multiplex: { enabled: true, protocol: 'h2mux', max_connections: 4 } } : {};
  switch (n.protocol) {
    case 'vless': return clean({ type: 'vless', ...base, uuid: n.uuid, flow: n.flow, tls: tls(n), transport: transport(n), packet_encoding: 'xudp', ...mux });
    case 'vmess': return clean({ type: 'vmess', ...base, uuid: n.uuid, security: n.security || 'auto', alter_id: n.alterId || 0, tls: tls(n), transport: transport(n), ...mux });
    case 'trojan': return clean({ type: 'trojan', ...base, password: n.password, tls: tls(n) || { enabled: true }, transport: transport(n), ...mux });
    case 'shadowsocks': return clean({ type: 'shadowsocks', ...base, method: n.method, password: n.password, ...mux });
    case 'hysteria2': return clean({
      type: 'hysteria2', ...base, password: n.password, tls: tls(n) || { enabled: true, server_name: n.sni },
      obfs: n.obfs ? { type: n.obfs.type, password: n.obfs.password } : undefined,
      server_ports: n.ports ? n.ports.split(',').map(p => p.replace('-', ':')) : undefined,
      up_mbps: n.upMbps, down_mbps: n.downMbps,
    });
    case 'hysteria': return clean({ type: 'hysteria', ...base, auth_str: n.password, up_mbps: n.upMbps || 50, down_mbps: n.downMbps || 200, tls: tls(n) || { enabled: true } });
    case 'tuic': return clean({ type: 'tuic', ...base, uuid: n.uuid, password: n.password, congestion_control: n.congestion || 'bbr', tls: tls(n) || { enabled: true } });
    case 'ssh': return clean({ type: 'ssh', ...base, user: n.username, password: n.password });
    case 'socks': return clean({ type: 'socks', ...base, version: '5', username: n.username, password: n.password });
    case 'http': return clean({ type: 'http', ...base, username: n.username, password: n.password, tls: tls(n) });
    case 'wireguard': return n.wg ? clean({
      type: 'wireguard', tag, address: n.wg.address, private_key: n.wg.privateKey, mtu: n.wg.mtu || 1408,
      peers: [clean({ address: n.server, port: n.port, public_key: n.wg.publicKey, pre_shared_key: n.wg.preSharedKey, allowed_ips: ['0.0.0.0/0', '::/0'], reserved: n.wg.reserved })],
      __endpoint: true,
    }) : null;
    default: return null;
  }
}

function clean<T extends Record<string, any>>(o: T): T {
  for (const k of Object.keys(o)) if (o[k] === undefined || o[k] === '') delete o[k];
  return o;
}

function ruleToSingbox(r: RoutingRule, sets: Set<string>): any | null {
  if (!r.enabled) return null;
  const x: any = {};
  if (r.domain?.length) x.domain = r.domain;
  if (r.domainSuffix?.length) x.domain_suffix = r.domainSuffix;
  if (r.domainKeyword?.length) x.domain_keyword = r.domainKeyword;
  if (r.ipCidr?.length) x.ip_cidr = r.ipCidr;
  if (r.process?.length) x.process_name = r.process;
  if (r.port?.length) x.port = r.port.map(Number).filter(Boolean);
  const rs = [...(r.geosite || []).map(g => `geosite-${g}`), ...(r.geoip || []).map(g => `geoip-${g}`)];
  rs.forEach(t => sets.add(t)); if (rs.length) x.rule_set = rs;
  if (!Object.keys(x).length) return null;
  if (r.action === 'block') return { ...x, action: 'reject' };
  return { ...x, outbound: r.action === 'direct' ? 'direct' : 'proxy' };
}

export interface BuildResult { singbox: any; xrayNodes: { node: Node; port: number }[]; skipped: Node[] }

/** Полный конфиг. nodes — все узлы активной подписки; selected — выбранный (или авто). */
export function buildSingbox(nodes: Node[], selectedId: string | 'auto', routing: RoutingProfile, s: Settings): BuildResult {
  const outbounds: any[] = [], endpoints: any[] = [], tags: string[] = [];
  const xrayNodes: BuildResult['xrayNodes'] = [], skipped: Node[] = [];
  let selectedTag = '';
  nodes.forEach((n, i) => {
    const eng = engineFor(n);
    if (eng === 'amneziawg') { skipped.push(n); return; }
    const tag = tagOf(n, i);
    const xp = eng === 'xray' ? XRAY_BASE_PORT + xrayNodes.length : undefined;
    const ob = toOutbound(n, tag, s, xp);
    if (!ob) { skipped.push(n); return; }
    if (xp) xrayNodes.push({ node: n, port: xp });
    if (ob.__endpoint) { delete ob.__endpoint; endpoints.push(ob); } else outbounds.push(ob);
    tags.push(tag); if (n.id === selectedId) selectedTag = tag;
  });

  const sets = new Set<string>();
  const rules: any[] = [
    { action: 'sniff' },
    { protocol: 'dns', action: 'hijack-dns' },
    { ip_is_private: true, outbound: 'direct' },
  ];
  if (s.blockAds) { sets.add('geosite-category-ads-all'); rules.push({ rule_set: ['geosite-category-ads-all'], action: 'reject' }); }
  if (routing.mode === 'smart') {
    sets.add('geosite-category-ru'); sets.add('geoip-ru');
    rules.push({ rule_set: ['geosite-category-ru', 'geoip-ru'], outbound: 'direct' });
  }
  for (const r of routing.rules) { const x = ruleToSingbox(r, sets); if (x) rules.push(x); }

  const dnsServers: any[] = [
    { tag: 'remote', address: s.dnsRemote, detour: 'proxy' },
    { tag: 'direct-dns', address: s.dnsDirect, detour: 'direct' },
  ];
  const dnsRules: any[] = [{ outbound: 'any', server: 'direct-dns' }];
  if (routing.mode === 'smart') dnsRules.push({ rule_set: ['geosite-category-ru'], server: 'direct-dns' });
  if (s.fakeIp) { dnsServers.push({ tag: 'fakeip', address: 'fakeip' }); dnsRules.push({ query_type: ['A', 'AAAA'], server: 'fakeip' }); }

  const inbounds: any[] = [];
  if (s.inbound !== 'tun') inbounds.push({ type: 'mixed', tag: 'mixed-in', listen: s.allowLan ? '0.0.0.0' : '127.0.0.1', listen_port: s.mixedPort });
  if (s.inbound !== 'proxy') inbounds.push({
    type: 'tun', tag: 'tun-in', interface_name: 'Axon', address: ['172.19.0.1/30', ...(s.ipv6 ? ['fdfe:dcba:9876::1/126'] : [])],
    mtu: s.tunMtu, auto_route: true, strict_route: s.strictRoute, stack: s.tunStack,
  });

  const selector = { type: 'selector', tag: 'proxy', outbounds: tags.length ? ['auto', ...tags] : ['direct'], default: selectedTag || (tags.length ? 'auto' : 'direct'), interrupt_exist_connections: true };
  const urltest = tags.length ? [{ type: 'urltest', tag: 'auto', outbounds: tags, url: s.latencyUrl, interval: '3m', tolerance: 50 }] : [];

  const singbox: any = {
    log: { level: s.logLevel, timestamp: true },
    dns: clean({ servers: dnsServers, rules: dnsRules, final: 'remote', strategy: s.ipv6 ? 'prefer_ipv4' : 'ipv4_only',
      fakeip: s.fakeIp ? { enabled: true, inet4_range: '198.18.0.0/15', inet6_range: 'fc00::/18' } : undefined }),
    inbounds,
    outbounds: [selector, ...urltest, ...outbounds, { type: 'direct', tag: 'direct' }],
    ...(endpoints.length ? { endpoints } : {}),
    route: {
      rules, auto_detect_interface: true,
      final: routing.mode === 'direct' ? 'direct' : 'proxy',
      rule_set: [...sets].map(t => ({ tag: t, type: 'remote', format: 'binary', url: t.startsWith('geoip-') ? GEOIP(t.slice(6)) : GEOSITE(t.slice(8)), download_detour: 'direct' })),
    },
    experimental: {
      clash_api: { external_controller: `127.0.0.1:${s.clashApiPort}`, default_mode: 'rule' },
      cache_file: { enabled: true },
    },
  };
  return { singbox, xrayNodes, skipped };
}
