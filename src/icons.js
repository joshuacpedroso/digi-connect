// Ícones SVG (traço estilo lucide)
const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;

export const icons = {
  mic: svg('<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><path d="M12 18v4"/>'),
  micOff: svg('<path d="M2 2l20 20"/><path d="M18.9 13.3A7 7 0 0 0 19 11v-1"/><path d="M5 10v1a7 7 0 0 0 12 5"/><path d="M15 9.3V5a3 3 0 0 0-5.7-1.3"/><path d="M9 9v2a3 3 0 0 0 5.1 2.1"/><path d="M12 18v4"/>'),
  cam: svg('<path d="m16 13 5.2 3.5a.5.5 0 0 0 .8-.4V7.9a.5.5 0 0 0-.8-.4L16 11"/><rect x="2" y="6" width="14" height="12" rx="2"/>'),
  camOff: svg('<path d="M2 2l20 20"/><path d="M10.7 6H14a2 2 0 0 1 2 2v3.3l1 1L22 7v10"/><path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2"/>'),
  desk: svg('<path d="M3 9h18"/><path d="M5 9v10"/><path d="M19 9v10"/><rect x="8" y="3" width="8" height="6" rx="1"/>'),
  stand: svg('<circle cx="12" cy="5" r="2"/><path d="M12 7v7"/><path d="m8 21 4-7 4 7"/><path d="M8 11h8"/>'),
  meeting: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>'),
  people: svg('<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.4-2-6.5-4-8a5 5 0 0 0-.5-8.5"/>'),
  sparkle: svg('<path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2Z"/><path d="M19 17v4"/><path d="M17 19h4"/>'),
  logout: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>'),
  plus: svg('<path d="M12 5v14"/><path d="M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  target: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/>'),
  close: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
  walk: svg('<circle cx="13" cy="4" r="2"/><path d="m7 21 3-6 3 2v5"/><path d="m10 15 1-5 4 3 3 1"/><path d="M8 10l3-3 2 1"/>'),
  phone: svg('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>'),
  door: svg('<path d="M13 4h3a2 2 0 0 1 2 2v14"/><path d="M2 20h3"/><path d="M13 20h9"/><path d="M10 12v.01"/><path d="M13 4.6v16.1a.3.3 0 0 1-.4.3L5 19V5.6a1 1 0 0 1 .8-1l6-1.5a1 1 0 0 1 1.2 1Z"/>'),
  dice: svg('<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><circle cx="16" cy="16" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="16" cy="8" r="1"/><circle cx="8" cy="16" r="1"/>'),
  pin: svg('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>'),
};
