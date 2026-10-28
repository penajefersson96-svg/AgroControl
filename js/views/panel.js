/* =====================================================================
   views/panel.js — PANEL DE CONTROL (vista principal limpia)
   ===================================================================== */
'use strict';

Views.panel = function () {
  const l = Store.lote();
  if (!l) {
    return UI.empty('layers', 'Aún no hay registros',
      'Crea un cerdo individual o un lote para empezar a controlar costos.',
      `<button class="btn primary" data-action="openLote">${Icons.get('plus')}Nuevo registro</button>`);
  }

  const c = Calc.lote(l), ind = l.tipo === 'individual';
  const enBs = v => (c.tasa ? `≈ ${bs(v * c.tasa)}` : 'Define la tasa BCV para ver Bs');

  // Alertas de inventario
  const alertas = Calc.alertas();
  const aviso = alertas.length ? UI.notice('crit', 'alert',
    `<b>Inventario bajo: comprar de nuevo</b><br>${alertas.map(({ p, e }) =>
      `${esc(p.nombre)} · quedan ${dec(p.stock, 2)} ${esc(p.unidad)}${e.dias !== null ? ` (~${Math.floor(e.dias)} días)` : ''}`).join('<br>')}`) : '';

  // Ciclo inicio → fin + Etapa actual de crecimiento (5 a 6 meses)
  const ciclo = `
    <div class="card">
      <div class="cycle-dates">
        <div><span class="label">Inicio</span><b class="num">${fecha(l.fechaInicio)}</b></div>
        <div><span class="label">Fin ${l.fechaFin ? '' : '(meta ~5.5 meses)'}</span><b class="num">${l.fechaFin ? fecha(l.fechaFin) : '—'}</b></div>
      </div>
      <div class="progress"><i style="width:${c.progreso}%"></i></div>
      <div class="cycle-foot">
        <span>${c.estado === 'programado' ? 'Aún no inicia' : `Día ${c.dias} (${c.semanas} sem · ${c.meses} meses)`}</span> <span>${c.estado === 'finalizado' ? 'Ciclo terminado' : `Faltan ~${c.restantes} días`}</span>
      </div>
      <div class="rows" style="margin-top:12px; padding-top:10px; border-top:1px solid var(--border, rgba(0,0,0,0.08))">
        <div><span>Etapa actual del cerdo</span><b>${c.etapaActual.nombre}</b></div>
        <div><span>Alimento que toca</span><b>${c.etapaActual.alimento}</b></div>
        <div><span>Meta de peso en esta fase</span><b class="num">${c.etapaActual.metaPeso}</b></div>
      </div>
    </div>`;

  // Tarjetas principales
  const hero = `
    <div class="hero">
      <div class="label">Costo total acumulado</div>
      <div class="hero-value num">${usd(c.total)}</div>
      <div class="hero-sub num">${enBs(c.total)}</div>
    </div>`;

  const par = ind
    ? `<div class="grid2">
         ${UI.metric('Estado', c.vivos ? 'Vivo' : 'Baja', c.vivos ? 'En el corral' : (c.vendidos ? 'Vendido' : 'Murió'))}
         ${UI.metric('Peso actual', c.peso ? dec(c.peso) + ' kg' : '—', c.peso ? 'Último pesaje' : 'Sin pesajes')}
       </div>`
    : `<div class="grid2">
         ${UI.metric('Animales vivos', c.vivos, `de ${l.cantidadInicial} · ${c.muertos} muertos · ${c.vendidos} vendidos`)}
         ${UI.metric('Costo por animal vivo', usd(c.porAnimal), enBs(c.porAnimal))}
       </div>`;

  const kilo = `
    <div class="card accent">
      <div class="label">Costo real por kilo en pie (Vivo)</div>
      <div class="metric-value num">${c.peso > 0 ? usd(c.costoKg) : '—'}</div>
      <div class="metric-sub">${c.peso > 0
        ? `Precio mínimo de venta en pie · ${dec(c.kilos, 1)} kg ${ind ? '' : 'totales '}· ${enBs(c.costoKg)} por kg`
        : 'Registra el peso para calcular el precio mínimo de venta'}</div>
      <form data-form="peso" class="inline" style="margin-top:14px" autocomplete="off">
        <input class="field" name="peso" type="number" inputmode="decimal" step="any" min="0" required
               placeholder="${ind ? 'Peso actual del cerdo (kg)' : 'Peso promedio por cerdo (kg)'}" value="${c.peso || ''}">
        <input type="hidden" name="fecha" value="${Utils.today()}">
        <button class="btn primary">Guardar</button>
      </form>
    </div>`;

  // Diagnóstico automático de calidad
  let diagCanal = 'Registra el peso vivo y sin tripas al finalizar para evaluar la calidad.';
  if (c.peso > 0 && c.pesoCanal > 0) {
    if (c.rendimientoCanal >= 75) diagCanal = '✅ Excelente rendimiento en canal (+75%). Buena genética y nutrición limpia.';
    else if (c.rendimientoCanal >= 71) diagCanal = '👍 Rendimiento normal (71% - 74%). Dentro del promedio aceptable.';
    else diagCanal = '⚠️ Rendimiento bajo (<71%). Mucha merma en tripas o exceso de fibra/grasa en la dieta.';
  }

  let diagFcr = '';
  if (c.fcr > 0) {
    if (c.fcr <= 2.9) diagFcr = '✅ Conversión excelente: el cerdo aprovechó muy bien el alimento.';
    else if (c.fcr <= 3.4) diagFcr = '👍 Conversión aceptable: consumo normal para el peso ganado.';
    else diagFcr = '⚠️ Conversión alta: comió demasiado alimento para los kilos que subió (revisar desperdicio o parásitos).';
  }

  // Control de Calidad (Peso con tripas vs sin tripas)
  const calidad = `
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px">
        <h2 style="margin:0">Control de Calidad (Canal vs. Vivo)</h2>
        <button class="btn secondary" data-action="openCalidad" data-id="${l.id}" style="padding:6px 10px; font-size:13px; flex-shrink:0">
          ${c.tieneCanalReal ? 'Editar cierre' : 'Registrar beneficio'}
        </button>
      </div>
      <p class="hint" style="margin-bottom:10px">Compara el cochino vivo (80–100 kg) contra el peso sin tripas (${c.tieneCanalReal ? 'datos reales registrados' : 'estimado al 75%'}).</p>
      <div class="rows">
        <div><span>Peso vivo (completo con tripas)</span><b class="num">${c.peso ? dec(c.peso, 1) + ' kg' : '—'}</b></div>
        <div><span>Peso en canal (sin tripas)</span><b class="num">${c.pesoCanal ? dec(c.pesoCanal, 1) + ' kg' : '—'}</b></div>
        <div><span>Merma de tripas y vísceras</span><b class="num">${c.peso ? dec(c.mermaTripasKg, 1) + ' kg (-' + dec(100 - c.rendimientoCanal, 1) + '%)' : '—'}</b></div>
        <div><span>Rendimiento de carne limpia</span><b class="num">${c.peso ? dec(c.rendimientoCanal, 1) + '%' : '—'}</b></div>
        <div><span>Costo real por kg sin tripas</span><b class="num">${c.costoKgCanal ? usd(c.costoKgCanal) + ' (' + enBs(c.costoKgCanal) + ')' : '—'}</b></div>
      </div>
      <div style="margin-top:10px; padding:10px; border-radius:8px; background:var(--bg-soft, rgba(0,0,0,0.04)); font-size:13px">
        <b>Evaluación de esta cría:</b><br>
        ${diagCanal}
        ${diagFcr ? `<br>${diagFcr}` : ''}
        ${l.notasCalidad ? `<br><br><b>Notas para mejorar en la próxima cría:</b><br>${esc(l.notasCalidad)}` : ''}
      </div>
    </div>`;

  // Rendimiento
  const guion = v => (v ? v : '—');
  const rendimiento = `
    <div class="card">
      <h2>Rendimiento y Alimentación</h2>
      <div class="rows">
        <div><span>Ganancia diaria de peso</span><b class="num">${guion(c.gdp ? dec(c.gdp, 0) + ' g/día' : '')}</b></div>
        <div><span>Conversión alimenticia</span><b class="num">${guion(c.fcr ? dec(c.fcr, 2) + ' kg/kg' : '')}</b></div>
        <div><span>Alimento consumido total</span><b class="num">${guion(c.kgAlimento ? dec(c.kgAlimento, 1) + ' kg (' + dec(c.kgAlimento / 40, 2) + ' sacos)' : '')}</b></div>
        <div><span>Descuento automático hoy</span><b class="num">${c.consumoKg ? dec(c.consumoKg, 1) + ' kg/día' : 'No configurada'}</b></div>
        <div><span>Guía sugerida (${c.etapaActual.alimento})</span><b class="num">${dec(c.etapaActual.kgSugerido, 2)} kg/cerdo (${dec(c.consumoSugeridoLote, 1)} kg lote)</b></div>
        ${c.ingresosVentas ? `<div><span>Ingresos por ventas</span><b class="num">${usd(c.ingresosVentas)}</b></div>` : ''}
        ${ind ? '' : `<div><span>Mortalidad</span><b class="num">${dec(c.mortalidad, 1)}%</b></div>`}
      </div>
    </div>`;

  // Desglose de costos
  const partes = [['c1', 'Compra', c.compra], ['c2', 'Alimento', c.alimento], ['c3', 'Veterinario y medicinas', c.vet], ['c4', 'Varios', c.varios]];
  const desglose = `
    <div class="card">
      <h2>Desglose de costos</h2>
      <div class="stackbar">${partes.map(([k, , v]) => `<i class="${k}" style="width:${c.total ? (v / c.total) * 100 : 0}%"></i>`).join('')}</div>
      <div class="rows">${partes.map(([k, t, v]) =>
        `<div><span><i class="dot ${k}"></i>${t}</span><b class="num">${usd(v)}</b></div>`).join('')}</div>
    </div>`;

  return `<div class="stack">
    ${aviso}
    <div class="titleblock">
      <div><div class="eyebrow">${ind ? 'Cerdo individual' : 'Lote · ' + l.cantidadInicial + ' animales'}</div><h1>${esc(l.nombre)}</h1></div>
      ${UI.estadoBadge(c.estado)}
    </div>
    ${ciclo}
    ${hero}
    ${par}
    ${kilo}
    ${calidad}
    ${rendimiento}
    ${desglose}
    <button class="btn wa block" data-action="share">${Icons.get('send')}Compartir por WhatsApp</button>
  </div>`;
};
