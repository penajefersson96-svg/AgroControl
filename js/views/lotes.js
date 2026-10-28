/* =====================================================================
   views/lotes.js — lista de lotes / cerdos y respaldo de datos
   ===================================================================== */
'use strict';

Views.lotes = function () {
  const s = Store.state;

  const lista = s.lotes.length ? s.lotes.map(l => {
    const c = Calc.lote(l), activo = l.id === s.loteActivoId, ind = l.tipo === 'individual';
    return `<div class="card" ${activo ? 'style="border-color:var(--brand)"' : ''}>
      <div class="item-head">
        <div><div class="name">${esc(l.nombre)}</div>
          <div class="muted small">${ind ? 'Cerdo individual' : 'Lote de ' + l.cantidadInicial + ' animales'}</div></div>
        <div style="display:flex;gap:6px">${activo ? UI.badge('Abierto', 'brand') : ''}${UI.estadoBadge(c.estado)}</div>
      </div>
      <div class="rows" style="margin-top:10px">
        <div><span>Inicio</span><b class="num">${fecha(l.fechaInicio)}</b></div>
        <div><span>Fin</span><b class="num">${l.fechaFin ? fecha(l.fechaFin) : 'Sin definir'}</b></div>
        <div><span>${ind ? 'Estado' : 'Vivos'}</span><b class="num">${ind ? (c.vivos ? 'Vivo' : 'Baja') : c.vivos + ' / ' + l.cantidadInicial}</b></div>
        <div><span>Costo acumulado</span><b class="num">${usd(c.total)}</b></div>
      </div>
      <div class="actions">
        <button class="btn primary sm" data-action="selLoteBtn" data-id="${l.id}">Abrir</button>
        <button class="btn secondary sm" data-action="openLote" data-id="${l.id}">Editar</button>
        ${c.estado !== 'finalizado' ? `<button class="btn secondary sm" data-action="finLote" data-id="${l.id}">Finalizar hoy</button>` : ''}
        <button class="btn danger sm" data-action="delLote" data-id="${l.id}" aria-label="Borrar">${Icons.get('trash')}</button>
      </div>
    </div>`;
  }).join('') : UI.empty('layers', 'Sin registros', 'Crea tu primer cerdo o lote.');

  const respaldo = `
    <div class="card">
      <h2>Respaldo de datos</h2>
      <p class="muted small" style="margin-bottom:12px">Tus datos viven solo en este teléfono. Descarga un respaldo de vez en cuando; si cambias de equipo, impórtalo.</p>
      <div class="actions" style="margin-top:0">
        <button class="btn secondary sm" data-action="exportar">${Icons.get('download')}Exportar</button>
        <label class="btn secondary sm" style="cursor:pointer">${Icons.get('upload')}Importar
          <input type="file" accept="application/json,.json" data-change="importar" hidden></label>
      </div>
    </div>`;

  const ejemplo = `
    <div class="card">
      <h2>Datos de ejemplo</h2>
      <p class="muted small" style="margin-bottom:12px">Carga 3 ciclos cerrados (uno con poco alimento, uno con ración completa y uno con exceso) y 1 en curso, para ver cómo funcionan Ciclos y las recomendaciones. <b>Reemplaza tus datos actuales.</b></p>
      <button class="btn secondary block" data-action="cargarDemo">${Icons.get('repeat')}Cargar historial de ejemplo</button>
    </div>`;

  return `<div class="stack">
    <button class="btn primary block" data-action="openLote">${Icons.get('plus')}Nuevo cerdo o lote</button>
    ${lista}
    ${respaldo}
    ${ejemplo}
  </div>`;
};
