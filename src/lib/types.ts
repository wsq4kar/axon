/* Модель данных Axon. Всё хранится одним JSON-состоянием (store.ts). */

export type Protocol =
  | 'vless' | 'vmess' | 'trojan' | 'shadowsocks' | 'hysteria2' | 'hysteria' | 'tuic'
  | 'wireguard' | 'amneziawg' | 'ssh' | 'socks' | 'http' | 'shadowtls';

export type Transport = 'tcp' | 'ws' | 'grpc' | 'http' | 'httpupgrade' | 'xhttp' | 'quic';

/** Один сервер. Поля — объединение всего, что встречается в ссылках разных протоколов. */
export interface Node {
  id: string;
  name: string;
  protocol: Protocol;
  server: string;
  port: number;
  subId?: string;            // из какой подписки
  // учётные данные
  uuid?: string;
  password?: string;
  username?: string;
  method?: string;           // shadowsocks
  flow?: string;             // xtls-rprx-vision
  alterId?: number;          // vmess
  security?: string;         // vmess cipher
  // TLS / Reality
  tls?: boolean;
  sni?: string;
  alpn?: string[];
  fingerprint?: string;
  insecure?: boolean;
  reality?: { publicKey: string; shortId?: string; spiderX?: string };
  // транспорт
  transport?: Transport;
  path?: string;
  host?: string;
  serviceName?: string;
  mode?: string;             // xhttp mode
  // hysteria2 / tuic
  obfs?: { type: string; password: string };
  upMbps?: number;
  downMbps?: number;
  congestion?: string;
  ports?: string;            // диапазон портов (port hopping)
  // wireguard / amneziawg
  wg?: {
    privateKey: string; publicKey: string; preSharedKey?: string; address: string[];
    mtu?: number; reserved?: number[];
    awg?: Record<string, string | number>;   // Jc, Jmin, Jmax, S1..S4, H1..H4, I1..I5
  };
  // служебное
  raw?: string;              // исходная ссылка
  latency?: number | null;   // мс; null — не отвечает
  engine?: 'sing-box' | 'xray' | 'amneziawg';
}

export interface Subscription {
  id: string;
  name: string;
  url: string;
  updatedAt?: number;
  intervalHours?: number;    // из заголовка profile-update-interval
  userinfo?: { upload: number; download: number; total: number; expire: number };
  announce?: string;
  supportUrl?: string;
  webPageUrl?: string;
  routing?: RoutingProfile;  // из заголовка routing (формат Happ)
  hideSettings?: boolean;
  error?: string;
}

export type RuleAction = 'proxy' | 'direct' | 'block';

export interface RoutingRule {
  id: string;
  enabled: boolean;
  action: RuleAction;
  // любое из условий; внутри одного правила — ИЛИ
  domain?: string[];         // точное совпадение
  domainSuffix?: string[];
  domainKeyword?: string[];
  geosite?: string[];        // category-ru, category-ads-all…
  geoip?: string[];          // ru, private…
  ipCidr?: string[];
  process?: string[];        // telegram.exe
  port?: string[];
  note?: string;
}

export interface RoutingProfile {
  name: string;
  mode: 'global' | 'smart' | 'rules' | 'direct';   // smart = всё, кроме российского
  rules: RoutingRule[];
}

export interface Settings {
  language: 'ru' | 'en';
  inbound: 'proxy' | 'tun' | 'both';
  mixedPort: number;
  allowLan: boolean;
  engine: 'auto' | 'sing-box' | 'xray';
  autoSelect: boolean;          // автовыбор лучшего сервера
  failover: boolean;
  killSwitch: boolean;
  autoConnect: boolean;
  launchOnStartup: boolean;
  // DNS
  dnsRemote: string;            // https://1.1.1.1/dns-query
  dnsDirect: string;            // https://77.88.8.8/dns-query
  fakeIp: boolean;
  blockAds: boolean;
  ipv6: boolean;
  // анти-DPI
  tlsFragment: boolean;
  mux: boolean;
  // TUN
  tunStack: 'system' | 'gvisor' | 'mixed';
  tunMtu: number;
  strictRoute: boolean;
  // прочее
  latencyUrl: string;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  clashApiPort: number;
  subUserAgent: string;
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'ru', inbound: 'proxy', mixedPort: 2080, allowLan: false, engine: 'auto',
  autoSelect: true, failover: true, killSwitch: false, autoConnect: false, launchOnStartup: false,
  dnsRemote: 'https://1.1.1.1/dns-query', dnsDirect: 'https://77.88.8.8/dns-query',
  fakeIp: false, blockAds: false, ipv6: false, tlsFragment: false, mux: false,
  tunStack: 'mixed', tunMtu: 9000, strictRoute: true,
  latencyUrl: 'https://www.gstatic.com/generate_204', logLevel: 'warn', clashApiPort: 9097,
  subUserAgent: 'Happ/2.0 Axon/0.1',
};
