/* =====================================================================
   views/shell.js — cabecera y navegación inferior
   ===================================================================== */
'use strict';

Views.header = function () {
  const s = Store.state;
  const opciones = s.lotes.map(l =>
    [l.id, `${l.nombre} · ${l.tipo === 'individual' ? 'Cerdo individual' : 'Lote de ' + l.cantidadInicial}`]);
  return `
    <div class="row">
      <div class="brand"><img src="icons/icon.svg" alt="">AgroControl</div>
      <button class="chip" data-action="openTasa" aria-label="Tasa BCV">
        ${Icons.get('coin')}BCV ${s.tasa.valor ? 'Bs ' + dec(s.tasa.valor) : 'definir'}
      </button>
    </div>
    ${s.lotes.length ? `<div class="ctx"><select class="field" data-change="selLote" aria-label="Registro activo">${UI.options(opciones, s.loteActivoId)}</select></div>` : ''}`;
};

Views.nav = function () {
  const items = [['panel', 'chart', 'Panel'], ['registro', 'edit', 'Registro'], ['inventario', 'box', 'Inventario'], ['lotes', 'layers', 'Lotes']];
  const alertas = Calc.alertas().length;
  return `<div class="nav-inner">${items.map(([k, ic, t]) => `
    <button data-action="nav" data-tab="${k}" class="${UI.tab === k ? 'on' : ''}">
      ${Icons.get(ic)}<span>${t}</span>
      ${k === 'inventario' && alertas ? `<span class="pip">${alertas}</span>` : ''}
    </button>`).join('')}</div>`;
};
