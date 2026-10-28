/* =====================================================================
   views/ciclos.js — estadística y comparativo entre ciclos (lotes)
   Para ver qué mejoró, qué empeoró y qué ajustar en el próximo lote.
   ===================================================================== */
'use strict';

Views.ciclos = function () {
  const ord = Calc.ciclosOrdenados();
  if (!ord.length) {
    return UI.empty('trend', 'Aún no hay ciclos',
      'Cuando registres lotes o cerdos verás aquí cómo le fue a cada ciclo y qué mejorar en el siguiente.',
      `<button class="btn primary" data-action="openLote">${Icons.get('plus')}Nuevo registro</button>`);
  }

  const cis = ord.map(Calc.ciclo);

  /* ---------- Tabla comparativa (del más antiguo al más reciente) ---------- */
  // [etiqueta, valor, formato, mejorSiBaja (true/false) o null si no se compara]
  const filas = [
    ['Duración', c => c.dias, v => v + ' días', null],
    ['Animales vivos', c => c.animales, v => v, null],
    ['Mortalidad', c => (c.l.cantidadInicial > 1 ? c.mort : 0), v => dec(v, 1) + '%', true, 'ritmo'],
    ['Peso vivo', c => c.pesoVivo, v => dec(v, 1) + ' kg', false, 'final'],
    ['Peso en canal', c => c.pesoCanal, v => dec(v, 1) + ' kg', false, 'final'],
    ['Rendimiento canal', c => c.rend, v => dec(v, 1) + '%', false, 'ritmo'],
    ['Ganancia diaria', c => c.gdp, v => dec(v, 0) + ' g', false, 'ritmo'],
    ['Conversión', c => c.fcr, v => dec(v, 2), true, 'ritmo'],
    ['Alimento por cerdo', c => c.kgCerdo, v => dec(v, 1) + ' kg', null],
    ['Alimento vs guía', c => c.ratio * 100, v => dec(v, 0) + '%', null],
    ['Costo por animal', c => c.costoAnimal, v => usd(v), true, 'final'],
    ['Costo por kg vivo', c => c.costoKg, v => usd(v), true, 'final'],
    ['Costo por kg canal', c => c.costoKgCanal, v => usd(v), true, 'final']
  ];

  const celda = (fila, i) => {
    const [, get, fmt, mejorSiBaja, tipo] = fila, v = get(cis[i]);
    if (!(v > 0)) return '<td class="num">—</td>';
    let delta = '';
    const a = i > 0 ? get(cis[i - 1]) : 0;
    const comparable = tipo === 'ritmo' || (cis[i].c.estado === 'finalizado' && i > 0 && cis[i - 1].c.estado === 'finalizado');
    if (mejorSiBaja !== null && a > 0 && comparable) {
      const d = (v - a) / a;
      if (Math.abs(d) >= 0.01) {
        const bueno = mejorSiBaja ? d < 0 : d > 0;
        delta = `<small class="delta ${bueno ? 'good' : 'bad'}">${d > 0 ? '▲' : '▼'} ${Math.abs(Math.round(d * 100))}%</small>`;
      }
    }
    return `<td class="num">${fmt(v)}${delta}</td>`;
  };

  const tabla = `
    <div class="card">
      <h2>Comparativo de ciclos</h2>
      <p class="hint" style="margin-bottom:10px">De izquierda a derecha, del más antiguo al más reciente. Verde = mejoró contra el ciclo anterior; rojo = empeoró. Peso y costos solo se comparan entre ciclos terminados.</p>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th></th>${cis.map(c => `<th>${esc(c.l.nombre)}<br>${UI.estadoBadge(c.c.estado)}</th>`).join('')}</tr></thead>
        <tbody>${filas.map(f => `<tr><td>${f[0]}</td>${cis.map((_, i) => celda(f, i)).join('')}</tr>`).join('')}</tbody>
      </table></div>
    </div>`;

  /* ---------- Detalle y recomendaciones por ciclo (el más reciente primero) ---------- */
  const nombreEtapa = { 1: 'Iniciador (0–45 d)', 2: 'Desarrollo (46–105 d)', 3: 'Engorde (106+ d)' };
  const detalle = cis.map((ci, i) => {
    const prev = i > 0 ? cis[i - 1] : null;
    const hs = Calc.hallazgos(ci, prev);
    const etapas = ci.etapas.filter(e => e.guia > 0).map(e => {
      const p = e.real > 0 ? Math.round((e.real / e.guia) * 100) : 0;
      return `<div><span>${nombreEtapa[e.n]}</span><b class="num">${e.real > 0 ? dec(e.real, 1) : '0'} / ${dec(e.guia, 1)} kg${e.real > 0 ? ` · ${p}%` : ''}</b></div>`;
    }).join('');
    return `
    <div class="card">
      <div class="item-head">
        <div><div class="name">${esc(ci.l.nombre)}</div>
          <div class="muted small">${fecha(ci.l.fechaInicio)}${ci.l.fechaFin ? ' → ' + fecha(ci.l.fechaFin) : ' → en curso'} · ${ci.dias} días</div></div>
        ${UI.estadoBadge(ci.c.estado)}
      </div>
      ${etapas ? `<h2 style="margin-top:12px">Alimento por cerdo: real / guía</h2><div class="rows">${etapas}</div>` : ''}
      <h2 style="margin-top:12px">Lectura del ciclo</h2>
      <div>${hs.map(h => `<div class="finding">${UI.notice(h.tono, { ok: 'check', warn: 'alert', crit: 'alert', info: 'info' }[h.tono],
        `${esc(h.texto)}${h.accion ? `<span class="todo">Próximo ciclo: ${esc(h.accion)}</span>` : ''}`)}</div>`).join('')}</div>
      ${ci.l.notasCalidad ? `<p class="small" style="margin-top:12px"><b>Tus notas:</b> ${esc(ci.l.notasCalidad)}</p>` : ''}
      <div class="actions">
        <button class="btn secondary sm" data-action="openCalidad" data-id="${ci.l.id}">${ci.l.pesoFinalCanal ? 'Editar cierre y notas' : 'Registrar cierre y notas'}</button>
      </div>
    </div>`;
  }).reverse().join('');

  return `<div class="stack">
    <div class="titleblock"><div><div class="eyebrow">Estadística</div><h1>Ciclos</h1></div></div>
    ${UI.notice('info', 'info', 'Compara cada lote con el anterior y recibe sugerencias para el siguiente: por ejemplo, si diste poco alimento y los cerdos subieron lento, la app te avisa que debes subir la ración.')}
    ${tabla}
    ${detalle}
  </div>`;
};
