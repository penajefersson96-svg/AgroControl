/* =====================================================================
   views/modals.js — formularios emergentes (sin precios en las notas)
   ===================================================================== */
'use strict';

Views.formLote = function(id) {
  const l = id ? Store.lote(id) : null;
  const tipo = l ? l.tipo : 'lote';
  UI.modal(`
    <h2>${l ? 'Editar registro' : 'Nuevo registro'}</h2>
    <p class="lead">Un lote agrupa varios animales; un cerdo individual se controla por separado.</p>
    <form data-form="lote" class="form" data-tipo="${tipo}" autocomplete="off">
      <input type="hidden" name="id" value="${l ? l.id : ''}">
      <div class="f"><span class="label">Tipo de registro</span>
        <div class="seg">
          <label><input type="radio" name="tipo" value="lote" ${tipo === 'lote' ? 'checked' : ''}>Lote</label>
          <label><input type="radio" name="tipo" value="individual" ${tipo === 'individual' ? 'checked' : ''}>Cerdo individual</label>
        </div></div>
      <div class="f"><span class="label">Nombre o identificación</span>
        <input name="nombre" class="field" required placeholder="Ej. Lote 01 / Cerdo 07" value="${l ? esc(l.nombre) : ''}"></div>
      <div class="row2">
        <div class="f"><span class="label">Fecha de inicio</span>
          <input type="date" name="fechaInicio" class="field" required value="${l ? l.fechaInicio : Utils.today()}"></div>
        <div class="f"><span class="label">Fecha de fin (salida)</span>
          <input type="date" name="fechaFin" class="field" value="${l ? l.fechaFin : ''}"></div>
      </div>
      <div class="hint" style="margin-top:-6px">El ciclo dura entre 5 y 6 meses (150-180 días). La ración automática se detiene en la fecha de fin.</div>
      <div class="f" data-only="lote"><span class="label">Cantidad inicial de animales</span>
        <input name="cantidadInicial" type="number" inputmode="numeric" min="1" step="1" class="field" value="${l ? l.cantidadInicial : 10}"></div>
      <div class="f"><span class="label">
          <span data-only="lote">Precio total de compra de los lechones (USD)</span>
          <span data-only="individual">Precio de compra del cerdo (USD)</span></span>
        <input name="precioCompra" type="number" inputmode="decimal" step="any" min="0" class="field" required value="${l ? l.precioCompra : ''}"></div>
      <div class="f"><span class="label">Peso inicial por animal al llegar (kg)</span>
        <input name="pesoInicial" type="number" inputmode="decimal" step="any" min="0" class="field" value="${l && l.pesoInicial ? l.pesoInicial : ''}" placeholder="Ej. 10"></div>
      <div class="row2">
        <button type="button" class="btn secondary" data-action="closeModal">Cancelar</button>
        <button class="btn primary">Guardar</button>
      </div>
    </form>`);
};

Views.formCalidad = function(id) {
  const l = Store.lote(id);
  if (!l) return;
  const c = Calc.lote(l);
  UI.modal(`
    <h2>Control de Calidad Final</h2>
    <p class="lead">Registra el peso al finalizar la cría (con tripas vs. sin tripas) para evaluar el rendimiento real de tus animales y mejorar en el próximo lote.</p>
    <form data-form="calidad" class="form" autocomplete="off">
      <input type="hidden" name="id" value="${l.id}">
      <div class="row2">
        <div class="f"><span class="label">Peso vivo final (kg)</span>
          <input name="pesoFinalVivo" type="number" inputmode="decimal" step="any" min="0" class="field" required placeholder="Ej. 95" value="${l.pesoFinalVivo || c.peso || ''}">
          <span class="hint">Con tripas (80 a 100 kg)</span></div>
        <div class="f"><span class="label">Peso en canal (kg)</span>
          <input name="pesoFinalCanal" type="number" inputmode="decimal" step="any" min="0" class="field" required placeholder="Ej. 72" value="${l.pesoFinalCanal || ''}">
          <span class="hint">Limpio sin tripas</span></div>
      </div>
      <div class="f"><span class="label">Fecha de matanza / cierre (opcional)</span>
        <input type="date" name="fechaFin" class="field" value="${l.fechaFin || Utils.today()}"></div>
      <div class="f"><span class="label">Notas de evaluación (¿Qué funcionó y qué mejorar?)</span>
        <textarea name="notasCalidad" class="field" rows="3" placeholder="Ej. El alimento iniciador rindió muy bien, en engorde subieron rápido...">${l.notasCalidad ? esc(l.notasCalidad) : ''}</textarea></div>
      <div class="row2">
        <button type="button" class="btn secondary" data-action="closeModal">Cancelar</button>
        <button class="btn primary">Guardar evaluación</button>
      </div>
    </form>`);
};

Views.formTasa = function() {
  const t = Store.state.tasa;
  UI.modal(`
    <h2>Tasa del BCV</h2>
    <p class="lead">Bolívares por 1 USD. Se usa para mostrar equivalencias en Bs y queda guardada en cada gasto.${t.fecha ? ' Última actualización: ' + fecha(t.fecha) + '.' : ''}</p>
    <form data-form="tasa" class="form">
      <input name="valor" type="number" inputmode="decimal" step="any" min="0" class="field big" required placeholder="0.00" value="${t.valor || ''}">
      <div class="row2">
        <button type="button" class="btn secondary" data-action="closeModal">Cancelar</button>
        <button class="btn primary">Guardar</button>
      </div>
    </form>`);
};

Views.formProducto = function(id) {
  const p = id ? Store.producto(id) : null;
  const cats = ['Alimento', 'Vitamina', 'Medicina', 'Vacuna', 'Otros'];
  const cat = p ? p.categoria : 'Alimento';
  const esAlimento = cat === 'Alimento';
  const unidadActual = p ? p.unidad : (esAlimento ? 'sacos' : 'ml');
  
  const unidadesOpts = [
    ['sacos', 'Sacos (descuenta ración en kg)'],
    ['kg', 'Kilos (kg directos)'],
    ['ml', 'Frasco en ml / cc (descuenta por dosis en ml)'],
    ['gramos', 'Sobre en gramos (descuenta por gramos)'],
    ['dosis', 'Dosis individuales'],
    ['unidades', 'Unidades sueltas']
  ];
  
  UI.modal(`
    <h2>${p ? 'Editar producto' : 'Nuevo producto de inventario'}</h2>
    <form data-form="producto" class="form" autocomplete="off" style="margin-top:12px">
      <input type="hidden" name="id" value="${p ? p.id : ''}">
      <div class="f"><span class="label">Nombre del producto</span>
        <input name="nombre" class="field" required placeholder="Ej. Saco Iniciador / Vitamina / Sal" value="${p ? esc(p.nombre) : ''}"></div>
      <div class="row2">
        <div class="f"><span class="label">Categoría</span>
          <select name="categoria" class="field">${UI.options(cats.map(c => [c, c]), cat)}</select></div>
        <div class="f"><span class="label">Modo de medida</span>
          <select name="unidad" class="field">${UI.options(unidadesOpts, unidadActual)}</select></div>
      </div>
      <div class="f">
        <span class="label">Kg por saco (si es en sacos, ej. 40 kg)</span>
        <input name="kgPorUnidad" type="number" inputmode="decimal" step="any" min="1" class="field" value="${p ? (p.kgPorUnidad || 40) : 40}">
        <span class="hint">Para sacos de 40 kg pon <b>40</b>. Si elegiste <b>ml/cc</b> para un frasco, ingresa en cantidad inicial cuántos <b>ml totales</b> trae el envase (ej. 100 ml) para descontar por pequeñas dosis.</span>
      </div>
      ${p ? '' : `
      <div class="row2">
        <div class="f"><span class="label">Cantidad inicial (Sacos, ml o kg)</span>
          <input name="stock" type="number" inputmode="decimal" step="any" min="0" class="field" value="1" required></div>
        <div class="f"><span class="label">Costo total de esa cantidad (USD)</span>
          <input name="costoInicial" type="number" inputmode="decimal" step="any" min="0" class="field" placeholder="0.00" required></div>
      </div>
      <div class="hint" style="margin-top:-6px">Para sacos indica cuántos sacos tienes. Para frascos en ml indica el total de mililitros del frasco para que cada dosis en ml descuente su parte exacta.</div>`}
      <div class="f"><span class="label">Avisar cuando quede menos de (mínimo)</span>
        <input name="minimo" type="number" inputmode="decimal" step="any" min="0" class="field" required value="${p ? p.minimo : 1}" placeholder="Ej. 1 saco o 20 ml"></div>
      <div class="row2">
        <button type="button" class="btn secondary" data-action="closeModal">Cancelar</button>
        <button class="btn primary">Guardar</button>
      </div>
    </form>`);
};

Views.formCompra = function(id) {
  const p = Store.producto(id);
  const esSaco = p.unidad === 'sacos';
  const esMl = p.unidad === 'ml';
  UI.modal(`
    <h2>Comprar / Recargar inventario</h2>
    <p class="lead">${esc(p.nombre)} · disponible hoy: <b>${dec(p.stock)} ${esc(p.unidad)}</b>${esSaco ? ` (${dec(p.stock * (p.kgPorUnidad || 40))} kg)` : ''}</p>
    <form data-form="compra" class="form" autocomplete="off">
      <input type="hidden" name="productoId" value="${p.id}">
      <div class="f">
        <span class="label">${esMl ? 'Cantidad de ml/cc que trae el frasco comprado (ej. 100)' : `Cantidad comprada (${esc(p.unidad)})`}</span>
        <input name="cantidad" type="number" inputmode="decimal" step="any" min="0" class="field big" required placeholder="${esMl ? 'Ej. 100' : 'Ej. 5'}">
      </div>
      <div class="row2">
        <div class="f"><span class="label">Costo TOTAL pagado (USD)</span>
          <input name="costoUSD" type="number" inputmode="decimal" step="any" min="0" class="field" required placeholder="0.00"></div>
        <div class="f"><span class="label">Fecha</span>
          <input type="date" name="fecha" class="field" value="${Utils.today()}" required></div>
      </div>
      <div class="row2">
        <button type="button" class="btn secondary" data-action="closeModal">Cancelar</button>
        <button class="btn primary">Sumar al inventario</button>
      </div>
    </form>`);
};

Views.formRacion = function(id) {
  const r = Store.racion(id),
    p = Store.producto(r.productoId);
  const etapas = [
    ['1', 'Etapa 1: Iniciador — Pequeño (Días 0 a 45)'],
    ['2', 'Etapa 2: Engorde / Desarrollo — Mediano (Días 46 a 105)'],
    ['3', 'Etapa 3: Finalizador — Grande (Días 106 a 180)'],
    ['todas', 'Todo el ciclo (Sin límite de días)']
  ];
  let etapaSel = 'todas';
  if (r.diaDesde === 0 && r.diaHasta === 45) etapaSel = '1';
  else if (r.diaDesde === 46 && r.diaHasta === 105) etapaSel = '2';
  else if (r.diaDesde === 106) etapaSel = '3';
  
  UI.modal(`
    <h2>Configurar ración por etapa</h2>
    <p class="lead">${p ? esc(p.nombre) : ''}. Se descontará automáticamente solo durante los días de la etapa que elijas.</p>
    <form data-form="racionEdit" class="form" autocomplete="off">
      <input type="hidden" name="id" value="${r.id}">
      <div class="f"><span class="label">Etapa del cochino</span>
        <select name="etapaRacion" class="field">${UI.options(etapas, etapaSel)}</select>
      </div>
      <div class="f"><span class="label">Kg que come cada cochino al día en esta etapa</span>
        <input name="kgPorAnimal" type="number" inputmode="decimal" step="any" min="0" class="field big" required value="${r.kgPorAnimal}" placeholder="Ej. 0.8 / 1.8 / 2.6">
        <span class="hint">Guía: Pequeño (0.6 a 1.0 kg) · Mediano (1.6 a 2.1 kg) · Grande (2.5 a 2.8 kg)</span>
      </div>
      <div class="row2">
        <button type="button" class="btn secondary" data-action="closeModal">Cancelar</button>
        <button class="btn primary">Guardar</button>
      </div>
    </form>`);
};

Views.modalShare = function(l) {
  UI.modal(`
    <h2>Resumen para compartir</h2>
    <p class="lead">Copia el texto o envíalo directo por WhatsApp.</p>
    <textarea id="share-text" class="field" rows="12" readonly style="font-size:14px">${esc(Share.texto(l))}</textarea>
    <div class="row2" style="margin-top:12px">
      <button class="btn secondary" data-action="copyShare">Copiar</button>
      <button class="btn wa" data-action="waShare">${Icons.get('send')}WhatsApp</button>
    </div>
    <button class="btn ghost block" data-action="closeModal" style="margin-top:6px">Cerrar</button>`);
};