/* Конфиг Xray для узлов, которые sing-box не умеет (XHTTP и др.): каждый узел слушает
   свой локальный socks-порт, а sing-box ходит к нему как к обычному socks-прокси. */
import type { Node } from './types';

function stream(n: Node): any {
  const s: any = { network: n.transport === 'xhttp' ? 'xhttp' : (n.transport || 'tcp') };
  if (n.reality) s.security = 'reality';
  else if (n.tls) s.security = 'tls';
  if (s.security === 'reality') s.realitySettings = { serverName: n.sni || '', fingerprint: n.fingerprint || 'chrome', publicKey: n.reality!.publicKey, shortId: n.reality!.shortId || '', spiderX: n.reality!.spiderX || '' };
  if (s.security === 'tls') s.tlsSettings = { serverName: n.sni || '', fingerprint: n.fingerprint || 'chrome', allowInsecure: !!n.insecure, ...(n.alpn ? { alpn: n.alpn } : {}) };
  if (n.transport === 'xhttp') s.xhttpSettings = { path: n.path || '/', host: n.host || '', mode: n.mode || 'auto' };
  if (n.transport === 'ws') s.wsSettings = { path: n.path || '/', headers: n.host ? { Host: n.host } : {} };
  if (n.transport === 'grpc') s.grpcSettings = { serviceName: n.serviceName || '' };
  return s;
}

function outbound(n: Node, tag: string): any {
  if (n.protocol === 'vless') return { tag, protocol: 'vless', settings: { vnext: [{ address: n.server, port: n.port, users: [{ id: n.uuid, encryption: 'none', flow: n.flow || '' }] }] }, streamSettings: stream(n) };
  if (n.protocol === 'vmess') return { tag, protocol: 'vmess', settings: { vnext: [{ address: n.server, port: n.port, users: [{ id: n.uuid, alterId: n.alterId || 0, security: n.security || 'auto' }] }] }, streamSettings: stream(n) };
  if (n.protocol === 'trojan') return { tag, protocol: 'trojan', settings: { servers: [{ address: n.server, port: n.port, password: n.password }] }, streamSettings: stream(n) };
  return { tag, protocol: 'freedom' };
}

export function buildXray(list: { node: Node; port: number }[], logLevel: string): any {
  return {
    log: { loglevel: logLevel === 'error' ? 'error' : logLevel === 'debug' ? 'debug' : 'warning' },
    inbounds: list.map(({ port }, i) => ({ tag: `in-${i}`, listen: '127.0.0.1', port, protocol: 'socks', settings: { udp: true } })),
    outbounds: list.map(({ node }, i) => outbound(node, `out-${i}`)),
    routing: { rules: list.map((_, i) => ({ type: 'field', inboundTag: [`in-${i}`], outboundTag: `out-${i}` })) },
  };
}
