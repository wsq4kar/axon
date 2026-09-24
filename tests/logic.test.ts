import { parseSubscriptionBody, parseWgConf, engineFor, b64encode } from '../src/lib/uri';
import { applyHeaders, parseHappRouting } from '../src/lib/happ';
import { buildSingbox } from '../src/lib/singbox';
import { buildXray } from '../src/lib/xray';
import { DEFAULT_SETTINGS } from '../src/lib/types';
import { PRESETS } from '../src/lib/presets';
import { DEMO_SUB } from '../src/lib/demo';

let fail = 0; const ok = (c: any, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };

const nodes = parseSubscriptionBody(DEMO_SUB);
ok(nodes.length === 8, `демо-подписка: ${nodes.length}/8 узлов`);
console.log('  ', nodes.map(n => `${n.protocol}${n.transport ? '/' + n.transport : ''}→${engineFor(n)}`).join(', '));
const b64 = parseSubscriptionBody(b64encode(DEMO_SUB));
ok(b64.length === 8, 'та же подписка в base64');
const v = nodes[0]; ok(v.reality?.publicKey && v.flow === 'xtls-rprx-vision' && v.sni === 'www.microsoft.com', 'VLESS Reality: ключ, flow, sni');
ok(nodes[2].transport === 'xhttp' && engineFor(nodes[2]) === 'xray', 'XHTTP уходит в Xray');
ok(nodes[4].method === '2022-blake3-aes-128-gcm', 'Shadowsocks 2022: метод');
ok(nodes[6].protocol === 'vmess' && nodes[6].transport === 'grpc', 'VMess gRPC');
ok(nodes[7].protocol === 'amneziawg' && nodes[7].wg?.awg?.JC === 4, 'AmneziaWG из ссылки: параметры Jc/H1..');

const conf = `[Interface]\nPrivateKey = abc=\nAddress = 10.8.1.2/32\nJc = 5\nJmin = 50\nJmax = 1000\nS1 = 68\nS2 = 149\nS3 = 20\nS4 = 10\nH1 = 1-100\nI1 = <b 0x1234>\n[Peer]\nPublicKey = def=\nEndpoint = 1.2.3.4:51820\nAllowedIPs = 0.0.0.0/0`;
const awg2 = parseWgConf(conf, 'AWG 2.0');
ok(awg2?.protocol === 'amneziawg' && awg2.wg?.awg?.S3 === 20 && awg2.wg?.awg?.H1 === '1-100' && awg2.wg?.awg?.I1 === '<b 0x1234>', 'AmneziaWG 2.0 .conf: S3/S4, диапазоны H, I1');

const routing = parseHappRouting('happ://routing/onadd/' + btoa(JSON.stringify({ Name: 'RU', GlobalProxy: 'true', DirectSites: ['geosite:category-ru', 'domain:vk.com'], DirectIp: ['geoip:ru', '10.0.0.0/8'], BlockSites: ['geosite:category-ads-all'] })));
ok(routing?.rules.length === 2 && routing.rules[1].geosite?.[0] === 'category-ru' && routing.rules[1].ipCidr?.[0] === '10.0.0.0/8', 'маршруты Happ: direct/block, geosite/geoip/cidr');
const sub = applyHeaders({ id: 's', name: '?', url: 'x' }, { 'profile-title': 'base64:' + b64encode('NexusVPN'), 'profile-update-interval': '2', 'subscription-userinfo': 'upload=1; download=2; total=100; expire=1800000000' });
ok(sub.name === 'NexusVPN' && sub.intervalHours === 2 && sub.userinfo?.total === 100, 'заголовки Happ: название base64, интервал, userinfo');

const { singbox, xrayNodes, skipped } = buildSingbox(nodes, nodes[0].id, PRESETS[0], { ...DEFAULT_SETTINGS, inbound: 'both', blockAds: true });
ok(singbox.outbounds.find((o: any) => o.type === 'vless')?.tls?.reality?.public_key, 'sing-box: VLESS с Reality');
ok(singbox.outbounds.find((o: any) => o.type === 'hysteria2'), 'sing-box: Hysteria2');
ok(xrayNodes.length === 1 && singbox.outbounds.some((o: any) => o.type === 'socks' && o.server_port === 10800), 'XHTTP → socks к локальному Xray :10800');
ok(skipped.length === 1 && skipped[0].protocol === 'amneziawg', 'AmneziaWG не попадает в sing-box');
ok(singbox.inbounds.length === 2 && singbox.inbounds[1].type === 'tun', 'входы: mixed + TUN');
ok(singbox.route.rule_set.some((r: any) => r.tag === 'geosite-category-ru') && singbox.route.rule_set.some((r: any) => r.tag === 'geosite-category-ads-all'), 'наборы правил: Россия напрямую, реклама');
ok(singbox.outbounds[0].default.startsWith('1·'), 'выбран первый узел');
const x = buildXray(xrayNodes, 'warn');
ok(x.outbounds[0].streamSettings.network === 'xhttp' && x.outbounds[0].streamSettings.realitySettings.publicKey, 'Xray: XHTTP + Reality');
console.log(fail ? `\n${fail} ПРОВАЛОВ` : '\nвсё прошло');
process.exit(fail ? 1 : 0);
