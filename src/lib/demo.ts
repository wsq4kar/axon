import { b64encode } from './uri';
/* Демо-подписка для показа интерфейса в браузере: реальные форматы ссылок, выдуманные данные. */
export const DEMO_SUB = [
  'vless://11111111-2222-3333-4444-555555555555@nl.example.net:443?security=reality&sni=www.microsoft.com&fp=chrome&pbk=Q4JzX2qTg6mZkq0vBmU2tXw0VtN2mZ9hQfL0y3rQ0kY&sid=6ba85179e30d4fc2&flow=xtls-rprx-vision&type=tcp#🇳🇱 Нидерланды · Reality',
  'hy2://secretpass@nl.example.net:8443?sni=nl.example.net#🇳🇱 Нидерланды · Hysteria2',
  'vless://11111111-2222-3333-4444-555555555555@lv.example.net:443?security=reality&sni=www.samsung.com&fp=chrome&pbk=Q4JzX2qTg6mZkq0vBmU2tXw0VtN2mZ9hQfL0y3rQ0kY&sid=1a2b&type=xhttp&path=%2Fx&mode=auto#🇱🇻 Латвия · XHTTP',
  'trojan://pw@de.example.net:443?security=tls&sni=de.example.net&type=ws&path=%2Fws#🇩🇪 Германия · Trojan WS',
  'ss://' + btoa('2022-blake3-aes-128-gcm:ZmFrZWtleWZha2VrZXkxMg==') + '@fi.example.net:8388#🇫🇮 Финляндия · Shadowsocks 2022',
  'tuic://11111111-2222-3333-4444-555555555555:pw@se.example.net:443?sni=se.example.net&congestion_control=bbr&alpn=h3#🇸🇪 Швеция · TUIC',
  'vmess://' + b64encode(JSON.stringify({ v: '2', ps: '🇺🇸 США · VMess gRPC', add: 'us.example.net', port: '443', id: '11111111-2222-3333-4444-555555555555', net: 'grpc', path: 'grpc', tls: 'tls', sni: 'us.example.net' })),
  'awg://cHJpdmF0ZWtleQ==@pl.example.net:51820?publickey=cHVibGlja2V5&address=10.8.0.2/32&jc=4&jmin=40&jmax=70&s1=0&s2=0&h1=1&h2=2&h3=3&h4=4#🇵🇱 Польша · AmneziaWG',
].join('\n');
