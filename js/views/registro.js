/* =====================================================================
   views/registro.js — uso de inventario (dosis ml/kg), ración por etapas, gastos, bajas y pesajes
   ===================================================================== */
'use strict';

Views.UNIDADES = ['sacos', 'kg', 'ml', 'gramos', 'litros', 'dosis', 'frascos', 'unidades'];
Views.CAT_GASTO = { alimento: 'Alimento', veterinario: 'Veterinario', varios: 'Varios' };

Views.catGastoDe = cat => (cat === 'Alimento' ? 'alimento' : cat === 'Otros' ? 'varios' : 'veterinario');

  return `<div class="stack">
    <div class="muted small">Registrando en <b>${esc(l.nombre)}</b> · Día ${Calc.lote(l).dias} (${Calc.lote(l).etapaActual.nombre})</div>
    <div class="seg">${tabs.map(([k, t]) =>
      `<button type="button" data-action="regTab" data-k="${k}" class="${UI.regTab === k ? 'on' : ''}">${t}</button>`).join('')}</div>
    ${cuerpo}
    ${Views.historial(l)}
  </div>`;
};

/* ---------- Uso MANUAL de inventario (Dosis en ml, gramos o kg) ---------- */
Views.formUso = function () {
  const inv = Store.state.inventario;
  if (!inv.length) {
    return UI.empty('box', 'Inventario vacío', 'Agrega tus productos en Inventario para poder descontarlos aquí.',
      `<button class="btn primary" data-action="nav" data-tab="inventario">Ir a Inventario</button>`);
  }
  const sel = UI.usoProducto || inv[0].id;
  return `
    <form data-form="uso" class="card form" autocomplete="off">
      <h2>Aplicar dosis o descontar insumo</h2>
      <div class="hint">Permite descontar <b>pequeñas dosis de un frasco (en ml/cc)</b>, gramos de sal o kilos sueltos de un saco sin gastar el envase completo.</div>
      <div class="f"><span class="label">Producto del inventario</span>
        <select name="productoId" class="field">${UI.options(inv.map(p => [p.id, `${p.nombre} · quedan ${dec(p.stock, 2)} ${p.unidad}${p.unidad === 'sacos' ? ` (${dec(p.stock * (p.kgPorUnidad || 40), 1)} kg)` : ''}`]), sel)}</select></div>
      <div class="row2">
        <div class="f"><span class="label">Cantidad aplicada <b id="uso-unit"></b></span>
          <input name="cantidad" type="number" inputmode="decimal" step="any" min="0" class="field" placeholder="Ej. 2 ml o 0.5 kg" required></div>
        <div class="f"><span class="label">Modo de descuento</span>
          <select name="modoUso" class="field">
            <option value="directo">En la unidad del producto (ml, kg, sacos)</option>
            <option value="kgSaco">Descontar por KILOS de un saco</option>
          </select></div>
      </div>
      <div class="row2">
        <div class="f"><span class="label">Fecha</span>
          <input type="date" name="fecha" class="field" value="${Utils.today()}" required></div>
        <div class="f"><span class="label">Nota (opcional)</span>
          <input name="nota" class="field" placeholder="Ej. 2 ml de vitamina por lechón"></div>
      </div>
      <div class="hint num" id="uso-preview"></div>
      <button class="btn primary block">Descontar del inventario</button>
    </form>`;
};

/* ---------- Ración diaria AUTOMÁTICA por Etapas ---------- */
Views.tabRacion = function (l) {
  const s = Store.state;
  const comidas = s.inventario.filter(p => p.categoria === 'Alimento');
  const lista = Calc.raciones(l.id);
  const c = Calc.lote(l);

  const nombreEtapa = r => {
    if (r.diaDesde === 0 && r.diaHasta === 45) return 'Etapa 1: Iniciador (Días 0–45)';
    if (r.diaDesde === 46 && r.diaHasta === 105) return 'Etapa 2: Engorde (Días 46–105)';
    if (r.diaDesde === 106) return 'Etapa 3: Finalizador (Días 106–180)';
    return 'Todo el ciclo';
  };

  const enCursoHoy = r => {
    if (!r.activa) return false;
    return (r.diaDesde == null || c.dias >= r.diaDesde) && (r.diaHasta == null || c.dias <= r.diaHasta);
  };

  const filas = lista.length ? lista.map(r => {
    const p = Store.producto(r.productoId);
    const activaHoy = enCursoHoy(r);
    const kgPU = p ? (p.kgPorUnidad || 40) : 40;
    const costoDiaCerdo = p ? (r.kgPorAnimal / kgPU) * (p.costoProm || 0) : 0;
    return `<div>
      <div class="grow">
        <div>
          <b>${p ? esc(p.nombre) : 'Producto eliminado'}</b>
          ${!r.activa ? UI.badge('Pausada') : (activaHoy ? UI.badge('Activa hoy', 'brand') : UI.badge('Programada'))}
        </div>
        <div class="sub num">${nombreEtapa(r)} · <b>${dec(r.kgPorAnimal, 2)} kg/cerdo</b> (${dec(r.kgPorAnimal * c.vivos, 1)} kg lote/día · ${usd(costoDiaCerdo * c.vivos)}/día)</div>
      </div>
      <div class="end">
        <button class="icon-btn" data-action="editRacion" data-id="${r.id}" aria-label="Editar">${Icons.get('edit')}</button>
        <button class="icon-btn" data-action="toggleRacion" data-id="${r.id}" aria-label="${r.activa ? 'Pausar' : 'Reanudar'}">${Icons.get(r.activa ? 'pause' : 'play')}</button>
        <button class="icon-btn danger" data-action="delRacion" data-id="${r.id}" aria-label="Eliminar">${Icons.get('trash')}</button>
      </div></div>`;
  }).join('') : '<p class="muted small">Todavía no hay raciones configuradas. Puedes dejar programadas las 3 etapas de una vez.</p>';

  const etapasOpts = [
    ['1', 'Etapa 1: Iniciador — Pequeño (Días 0 a 45)'],
    ['2', 'Etapa 2: Engorde — Mediano (Días 46 a 105)'],
    ['3', 'Etapa 3: Finalizador — Grande (Días 106 a 180)'],
    ['todas', 'Todo el ciclo (Sin límite de días)']
  ];

  const form = comidas.length ? `
    <form data-form="racion" class="card form" autocomplete="off">
      <h2>Programar ración por etapa</h2>
      <div class="hint">Configura cuánto come el cochino en cada etapa. La app convierte los kilos a fracciones de saco de 40 kg automáticamente.</div>
      <div class="f"><span class="label">Etapa de crecimiento</span>
        <select name="etapaRacion" class="field">${UI.options(etapasOpts, String(c.etapaActual.etapaNum))}</select></div>
      <div class="f"><span class="label">Alimento (del inventario)</span>
        <select name="productoId" class="field">${UI.options(comidas.map(p => [p.id, `${p.nombre} (quedan${dec(p.stock, 2)} ${p.unidad} =${dec(p.stock * (p.kgPorUnidad || 40), 1)} kg)`]), '')}</select></div>
      <div class="row2">
        <div class="f"><span class="label">Kg por cochino al día</span>
          <input name="kgPorAnimal" type="number" inputmode="decimal" step="any" min="0" class="field" required placeholder="Ej. ${c.etapaActual.kgSugerido}" value="${c.etapaActual.kgSugerido}"></div>
        <div class="f"><span class="label">Empezar desde</span>
          <input type="date" name="desde" class="field" value="${l.fechaInicio}" required></div>
      </div>
      <div class="hint">Guía: Iniciador <b>0.8 kg</b> · Engorde <b>1.8 kg</b> · Finalizador <b>2.6 kg</b></div>
      <div class="hint num" id="racion-preview"></div>
      <button class="btn primary block">${Icons.get('repeat')}Guardar etapa automática</button>
    </form>`
    : UI.notice('info', 'info', 'Para usar la ración automática, agrega primero tus sacos de <b>Iniciador, Engorde y Finalizador</b> en la pestaña Inventario.');

  return `
    ${UI.notice('info', 'info', 'Deja programadas tus 3 etapas (Iniciador, Engorde y Finalizador). La app detecta en qué día va el lote y descuenta sola los kilos del saco de 40 kg correspondiente.')}
    <div class="card"><h2>Plan de alimentación de ${esc(l.nombre)}</h2><div class="rows">${filas}</div></div>
    ${form}`;
};

/* ---------- Gasto directo (sin inventario) ---------- */
Views.formGasto = function () {
  return `
    <form data-form="gasto" class="card form" autocomplete="off">
      <div class="hint">Para gastos que no pasan por el inventario (veterinario, transporte, jornal, etc.).</div>
      <div class="row2">
        <div class="f"><span class="label">Categoría</span>
          <select name="categoria" class="field">${UI.options(Object.entries(Views.CAT_GASTO), 'veterinario')}</select></div>
        <div class="f"><span class="label">Fecha</span>
          <input type="date" name="fecha" class="field" value="${Utils.today()}" required></div>
      </div>
      <div class="f"><span class="label">Descripción</span>
        <input name="descripcion" class="field" placeholder="Ej. Consulta veterinaria, flete" required></div>
      <div class="row2">
        <div class="f"><span class="label">Cantidad (opcional)</span>
          <input name="cantidad" type="number" inputmode="decimal" step="any" min="0" class="field"></div>
        <div class="f"><span class="label">Unidad</span>
          <select name="unidad" class="field">${UI.options(Views.UNIDADES.map(u => [u, u]), 'unidades')}</select></div>
      </div>
      <div class="f"><span class="label">Costo total (USD)</span>
        <input name="costoUSD" type="number" inputmode="decimal" step="any" min="0" class="field big" required placeholder="0.00"></div>
      <div class="hint num" id="gasto-bs"></div>
      <button class="btn primary block">Guardar gasto</button>
    </form>`;
};

/* ---------- Bajas ---------- */
Views.formBaja = function (l) {
  const ind = l.tipo === 'individual';
  return `
    <form data-form="baja" class="card form" autocomplete="off">
      <div class="row2">
        <div class="f"><span class="label">Motivo</span>
          <select name="motivo" class="field">${UI.options([['muerte', 'Muerte'], ['venta', 'Venta anticipada']], 'muerte')}</select></div>
        <div class="f"><span class="label">Cantidad</span>
          <input name="cantidad" type="number" inputmode="numeric" min="1" step="1" class="field" value="1" required ${ind ? 'readonly' : ''}></div>
      </div>
      <div class="row2">
        <div class="f"><span class="label">Fecha</span>
          <input type="date" name="fecha" class="field" value="${Utils.today()}" required></div>
        <div class="f"><span class="label">Ingreso por venta (USD)</span>
          <input name="ingresoUSD" type="number" inputmode="decimal" step="any" min="0" class="field" placeholder="Solo si fue venta"></div>
      </div>
      <div class="f"><span class="label">Nota (opcional)</span>
        <input name="nota" class="field" placeholder="Ej. Causa o comprador"></div>
      <button class="btn primary block">Registrar baja</button>
    </form>`;
};

/* ---------- Pesaje ---------- */
Views.formPeso = function (l) {
  const ind = l.tipo === 'individual';
  return `
    <form data-form="peso" class="card form" autocomplete="off">
      <div class="hint">Cada pesaje queda guardado con su fecha para que veas cómo suben de peso mes a mes.</div>
      <div class="row2">
        <div class="f"><span class="label">${ind ? 'Peso (kg)' : 'Peso promedio por cerdo (kg)'}</span>
          <input name="peso" type="number" inputmode="decimal" step="any" min="0" class="field" required></div>
        <div class="f"><span class="label">Fecha</span>
          <input type="date" name="fecha" class="field" value="${Utils.today()}" required></div>
      </div>
      <button class="btn primary block">Guardar pesaje</button>
    </form>`;
};

/* ---------- Historial combinado ---------- */
Views.historial = function (l) {
  const s = Store.state;
  const items = [
    ...s.gastos.filter(x => x.loteId === l.id).map(x => ({ ...x, t: 'gasto' })),
    ...s.bajas.filter(x => x.loteId === l.id).map(x => ({ ...x, t: 'baja' })),
    ...s.pesajes.filter(x => x.loteId === l.id).map(x => ({ ...x, t: 'peso' }))
  ].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 60);

  const fila = it => {
    if (it.t === 'gasto') {
      return `<div><div class="grow">
          <div>${esc(it.descripcion || Views.CAT_GASTO[it.categoria])}${it.origen === 'auto' ? ' ' + UI.badge('Auto', 'brand') : ''}</div>
          <div class="sub num">${fecha(it.fecha)} · ${Views.CAT_GASTO[it.categoria]}${it.cantidad ? ` · ${dec(it.cantidad, 2)} ${esc(it.unidad)}` : ''}${it.tasa ? ` · ${bs(it.costoUSD * it.tasa)}` : ''}</div></div>
        <div class="end"><b class="num">${usd(it.costoUSD)}</b>
          <button class="icon-btn danger" data-action="delGasto" data-id="${it.id}" aria-label="Eliminar">${Icons.get('trash')}</button></div></div>`;
    }
    if (it.t === 'baja') {
      return `<div><div class="grow">
          <div>${it.motivo === 'muerte' ? 'Muerte' : 'Venta anticipada'} · ${it.cantidad} animal(es)</div>
          <div class="sub num">${fecha(it.fecha)}${it.nota ? ' · ' + esc(it.nota) : ''}</div></div>
        <div class="end">${it.ingresoUSD ? `<b class="num">${usd(it.ingresoUSD)}</b>` : ''}
          <button class="icon-btn danger" data-action="delBaja" data-id="${it.id}" aria-label="Eliminar">${Icons.get('trash')}</button></div></div>`;
    }
    return `<div><div class="grow"><div>Pesaje</div><div class="sub num">${fecha(it.fecha)}</div></div>
        <div class="end"><b class="num">${dec(it.peso)} kg</b>
          <button class="icon-btn danger" data-action="delPeso" data-id="${it.id}" aria-label="Eliminar">${Icons.get('trash')}</button></div></div>`;
  };

  return `<div class="card"><h2>Historial</h2>
    <div class="rows">${items.length ? items.map(fila).join('') : '<p class="muted small">Sin movimientos todavía.</p>'}</div></div>`;
};
