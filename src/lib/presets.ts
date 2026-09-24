/* Готовые профили маршрутизации. «Умный» — всё через VPN, кроме российского. */
import type { RoutingProfile } from './types';

export const PRESETS: RoutingProfile[] = [
  { name: 'Всё, кроме России', mode: 'smart', rules: [] },
  { name: 'Всё через VPN', mode: 'global', rules: [] },
  { name: 'Только по правилам', mode: 'rules', rules: [
    { id: 'p-ads', enabled: true, action: 'block', geosite: ['category-ads-all'], note: 'реклама' },
    { id: 'p-ru', enabled: true, action: 'direct', geosite: ['category-ru'], geoip: ['ru'], note: 'российские сайты напрямую' },
    { id: 'p-torrent', enabled: true, action: 'direct', process: ['qbittorrent.exe', 'utorrent.exe', 'transmission-qt.exe'], note: 'торренты напрямую' },
  ] },
  { name: 'Напрямую', mode: 'direct', rules: [] },
];
