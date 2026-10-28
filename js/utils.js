/* =====================================================================
   utils.js — funciones auxiliares (formato, fechas, avisos)
   ===================================================================== */
'use strict';

const Utils = {
  /** Escapa texto para insertarlo seguro en HTML */
  esc: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),

  /** Convierte "12,5" o "12.5" en número (0 si es inválido) */
  num(v) {
    const n = parseFloat(String(v ?? '').replace(',', '.'));
    return isFinite(n) ? n : 0;
  },

  /* ---- Fechas (siempre en formato ISO local "YYYY-MM-DD") ---- */
  iso(d) {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  },
  today() { return Utils.iso(new Date()); },
  addDays(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    return Utils.iso(new Date(y, m - 1, d + n));
  },
  /** Días entre dos fechas ISO (b - a) */
  diffDays(a, b) {
    const t = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
    return Math.round((t(b) - t(a)) / 86400000);
  },
  fecha(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  },

  /* ---- Formato de montos ---- */
  usd: n => '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  bs: n => 'Bs ' + (n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  dec: (n, d = 2) => (n || 0).toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: d }),

  uid: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7),

  /** Aviso flotante breve */
  toast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(Utils._t);
    Utils._t = setTimeout(() => { t.hidden = true; }, 2600);
  }
};

// Atajos globales usados por el resto de archivos
const { esc, num, usd, bs, dec, fecha } = Utils;
