/* =====================================================================
   ui.js — estado de la interfaz y componentes visuales reutilizables
   ===================================================================== */
'use strict';

const Views = {};   // Las vistas se registran en js/views/*.js

const UI = {
  tab: 'panel',            // panel | registro | inventario | lotes
  regTab: 'uso',           // uso | racion | gasto | baja | peso
  usoProducto: '',         // producto preseleccionado en "Uso de inventario"

  modal(html) {
    document.getElementById('modal-root').innerHTML =
      `<div class="backdrop" data-action="closeModal" data-backdrop="1"><div class="sheet">${html}</div></div>`;
  },
  closeModal() { document.getElementById('modal-root').innerHTML = ''; },

  badge: (texto, tono = '') => `<span class="badge ${tono}">${texto}</span>`,

  estadoBadge(estado) {
    return {
      programado: UI.badge('Programado', 'brand'),
      activo: UI.badge('En curso', 'ok'),
      finalizado: UI.badge('Finalizado')
    }[estado];
  },

  metric(label, valor, sub = '', clase = '') {
    return `<div class="card ${clase}">
      <div class="label">${label}</div>
      <div class="metric-value num">${valor}</div>
      ${sub ? `<div class="metric-sub">${sub}</div>` : ''}
    </div>`;
  },

  empty: (icono, titulo, texto, boton = '') => `
    <div class="card empty">${Icons.get(icono)}<h2>${titulo}</h2><p>${texto}</p>${boton}</div>`,

  notice: (tono, icono, html) => `<div class="notice ${tono}">${Icons.get(icono)}<div>${html}</div></div>`,

  /** Opciones <option> para un select a partir de [valor, texto] */
  options: (pares, seleccionado) =>
    pares.map(([v, t]) => `<option value="${esc(v)}" ${v === seleccionado ? 'selected' : ''}>${esc(t)}</option>`).join('')
};
