/* =====================================================================
   views/inventario.js — existencias, compras y alertas de reposición
   ===================================================================== */
'use strict';

Views.inventario = function () {
  const inv = Store.state.inventario;

  const tarjetas = inv.length ? inv.map(p => {
    const e = Calc.estadoProducto(p);
    const tono = e.nivel === 'ok' ? 'ok' : 'crit';
    const texto = { ok: 'Disponible', bajo: 'Poco', agotado: 'Agotado' }[e.nivel];
    const base = Math.max(p.minimo * 3, p.stock, 1);
    const pct = Math.min(100, (p.stock / base) * 100);
    const barra = e.nivel === 'ok' ? '' : (e.nivel === 'agotado' ? 'crit' : 'warn');
    const detalle = [esc(p.categoria), `mínimo ${dec(p.minimo)} ${esc(p.unidad)}`,
      p.costoProm ? `${usd(p.costoProm)} por ${esc(p.unidad)}` : ''].filter(Boolean).join(' · ');

    return `<div class="card">
      <div class="item-head">
        <div><div class="name">${esc(p.nombre)}</div><div class="muted small">${detalle}</div></div>
        ${UI.badge(texto, tono)}
      </div>
      <div class="stock-value num">${dec(p.stock)}<small>${esc(p.unidad)}</small></div>
      <div class="progress stock"><i class="${barra}" style="width:${pct}%"></i></div>
      ${e.dias !== null ? `<div class="muted small" style="margin-top:8px">Consumo automático: ${dec(e.consumo, 2)} ${esc(p.unidad)}/día · alcanza para ~${Math.floor(e.dias)} días</div>` : ''}
      ${e.nivel !== 'ok' ? `<div style="margin-top:10px">${UI.notice('crit', 'alert', '<b>Quedan pocas existencias: comprar de nuevo.</b>')}</div>` : ''}
      <div class="actions">
        <button class="btn primary sm" data-action="openCompra" data-id="${p.id}">${Icons.get('plus')}Compra</button>
        <button class="btn secondary sm" data-action="usarProducto" data-id="${p.id}">Usar</button>
        <button class="btn secondary sm" data-action="openProducto" data-id="${p.id}">Editar</button>
        <button class="btn danger sm" data-action="delProducto" data-id="${p.id}" aria-label="Borrar">${Icons.get('trash')}</button>
      </div>
    </div>`;
  }).join('') : UI.empty('box', 'Inventario vacío', 'Agrega alimento, medicinas y demás insumos para controlar existencias.');

  return `<div class="stack">
    <button class="btn primary block" data-action="openProducto">${Icons.get('plus')}Nuevo producto</button>
    ${tarjetas}
  </div>`;
};
