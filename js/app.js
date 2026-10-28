/* =====================================================================
   app.js — controlador principal (Con activador privado de Demo)
   ===================================================================== */
'use strict';

function rangoEtapa(codigo) {
  if (codigo === '1') return { diaDesde: 0, diaHasta: 45 };
  if (codigo === '2') return { diaDesde: 46, diaHasta: 105 };
  if (codigo === '3') return { diaDesde: 106, diaHasta: 200 };
  return { diaDesde: null, diaHasta: null };
}

const App = {
  /* ---------- Render ---------- */
  render() {
    document.getElementById('header').innerHTML = Views.header();
    document.getElementById('view').innerHTML = Views[UI.tab]();
    document.getElementById('nav').innerHTML = Views.nav();
    App.sync();
  },

  go(tab) { UI.tab = tab; App.render(); window.scrollTo(0, 0); },

  /** Actualiza los textos de vista previa de los formularios (costos, Bs, consumo) */
  sync() {
    const tasa = Store.state.tasa.valor;

    // Uso manual de inventario (soporta ml de frasco y kg de saco)
    const fu = document.querySelector('form[data-form="uso"]');
    if (fu) {
      const p = Store.producto(fu.productoId.value), cant = num(fu.cantidad.value);
      const modo = fu.modoUso ? fu.modoUso.value : 'directo';
      if (p) {
        const esKgDeSaco = (modo === 'kgSaco' && p.unidad === 'sacos');
        const unidadTexto = esKgDeSaco ? 'kg (del saco)' : p.unidad;
        document.getElementById('uso-unit').textContent = `(${unidadTexto})`;

        const cantEnUnidadProd = esKgDeSaco ? cant / (p.kgPorUnidad || 40) : cant;
        const usada = Math.min(cantEnUnidadProd, p.stock);
        const costo = usada * (p.costoProm || 0);
        const restante = Math.max(0, p.stock - usada);

        document.getElementById('uso-preview').textContent = cant > 0
          ? `Costo de esta dosis/uso: ${usd(costo)}${tasa ? ' (' + bs(costo * tasa) + ')' : ''} · Quedarán ${dec(restante, 2)} ${p.unidad}${p.unidad === 'sacos' ? ` (${dec(restante * (p.kgPorUnidad || 40), 1)} kg)` : ''}`
          : '';
      }
    }

    // Gasto directo
    const fg = document.querySelector('form[data-form="gasto"]');
    if (fg) {
      const c = num(fg.costoUSD.value);
      document.getElementById('gasto-bs').textContent = tasa
        ? (c ? `≈ ${bs(c * tasa)} a tasa ${dec(tasa)}` : '')
        : 'Define la tasa BCV para ver el equivalente en Bs';
    }

    // Ración
    const fr = document.querySelector('form[data-form="racion"]');
    if (fr) {
      const l = Store.lote(), p = Store.producto(fr.productoId.value), kg = num(fr.kgPorAnimal.value);
      const vivos = l ? Calc.vivosEn(l, Utils.today()) : 0;
      const kgPU = p ? (p.kgPorUnidad || 40) : 40;
      const sacosDia = (kg * vivos) / kgPU;
      const costoDia = p ? sacosDia * (p.costoProm || 0) : 0;
      document.getElementById('racion-preview').textContent = p && kg
        ? `Consumo del lote: ${dec(kg * vivos, 1)} kg/día (${vivos} cerdos) = ${dec(sacosDia, 3)} ${p.unidad}/día (${usd(costoDia)}/día)`
        : '';
    }
  },

  /* ---------- Acciones por clic (data-action) ---------- */
  actions: {
    nav: el => App.go(el.dataset.tab),
    regTab: el => { UI.regTab = el.dataset.k; App.render(); },
    closeModal: () => UI.closeModal(),
    openLote: el => Views.formLote(el.dataset.id),
    openCalidad: el => Views.formCalidad(el.dataset.id),
    openTasa: () => Views.formTasa(),
    openProducto: el => Views.formProducto(el.dataset.id),
    openCompra: el => Views.formCompra(el.dataset.id),
    editRacion: el => Views.formRacion(el.dataset.id),
    share: () => { const l = Store.lote(); if (l) Views.modalShare(l); },
    copyShare: () => Share.copiar(document.getElementById('share-text').value),
    waShare: () => Share.whatsapp(document.getElementById('share-text').value),
    cargarDemo: () => {
      if (!confirm('Esto REEMPLAZA tus datos actuales por datos de ejemplo (3 ciclos cerrados y 1 en curso). Exporta un respaldo antes si no quieres perderlos. ¿Continuar?')) return;
      App.instalarDemo();
    },
    exportar: () => { Store.exportJSON(); Utils.toast('Respaldo descargado'); },

    usarProducto(el) { UI.usoProducto = el.dataset.id; UI.regTab = 'uso'; App.go('registro'); },

    selLoteBtn(el) { Store.state.loteActivoId = el.dataset.id; Store.save(); App.go('panel'); },

    finLote(el) {
      Views.formCalidad(el.dataset.id);
    },

    toggleRacion(el) {
      const r = Store.racion(el.dataset.id);
      r.activa = !r.activa;
      if (r.activa) r.aplicadoHasta = Utils.addDays(Utils.today(), -1);
      Store.save(); Feed.aplicar(); App.render();
    },
    delRacion(el) {
      if (!confirm('¿Eliminar esta ración? Los gastos ya descontados se conservan.')) return;
      Store.state.raciones = Store.state.raciones.filter(r => r.id !== el.dataset.id);
      Store.save(); App.render();
    },

    delGasto(el) {
      if (!confirm('¿Eliminar este gasto? Si descontó inventario, la cantidad se devuelve.')) return;
      const s = Store.state, g = s.gastos.find(x => x.id === el.dataset.id);
      if (g && g.productoId && g.cantidad) { const p = Store.producto(g.productoId); if (p) p.stock += g.cantidad; }
      s.gastos = s.gastos.filter(x => x.id !== el.dataset.id);
      Store.save(); App.render();
    },
    delBaja(el) {
      if (!confirm('¿Eliminar esta baja?')) return;
      Store.state.bajas = Store.state.bajas.filter(x => x.id !== el.dataset.id);
      Store.save(); App.render();
    },
    delPeso(el) {
      Store.state.pesajes = Store.state.pesajes.filter(x => x.id !== el.dataset.id);
      Store.save(); App.render();
    },
    delProducto(el) {
      if (!confirm('¿Borrar este producto y sus raciones automáticas?')) return;
      const s = Store.state, id = el.dataset.id;
      s.inventario = s.inventario.filter(p => p.id !== id);
      s.raciones = s.raciones.filter(r => r.productoId !== id);
      Store.save(); App.render();
    },
    delLote(el) {
      if (!confirm('¿Borrar este registro y TODOS sus gastos, bajas, pesajes y raciones?')) return;
      const s = Store.state, id = el.dataset.id;
      s.lotes = s.lotes.filter(l => l.id !== id);
      ['gastos', 'bajas', 'pesajes', 'raciones'].forEach(k => { s[k] = s[k].filter(x => x.loteId !== id); });
      Store.normalize(); Store.save(); App.render();
    }
  },

  /* ---------- Datos de EJEMPLO: 3 ciclos cerrados con historia + 1 en curso ---------- */
  instalarDemo() {
    const hoy = Utils.today(), tasa = 45.50;
    const B = Store.blank();
    B.tasa = { valor: tasa, fecha: hoy };

    /** Crea un ciclo terminado con alimento por etapa, bajas, peso final y notas */
    const ciclo = (o) => {
      const id = o.id, ini = Utils.addDays(hoy, -o.hace), fin = Utils.addDays(ini, o.dias);
      B.lotes.push({
        id, tipo: 'lote', nombre: o.nombre, fechaInicio: ini, fechaFin: fin, cantidadInicial: o.cant,
        precioCompra: o.compra, pesoInicial: o.pesoIni, pesoFinalVivo: o.vivo, pesoFinalCanal: o.canal, notasCalidad: o.notas
      });
      (o.muertes || []).forEach(d => B.bajas.push({ id: id + '-b' + d, loteId: id, fecha: Utils.addDays(ini, d), cantidad: 1, motivo: 'muerte', ingresoUSD: 0, nota: 'Ejemplo' }));
      const vivosEn = f => Calc.vivosEn({ id, cantidadInicial: o.cant }, f);
      // kg por cerdo según la guía en cada etapa, multiplicado por el % que realmente se dio
      const lim = [[0, 45, 'Iniciador'], [46, 105, 'Desarrollo'], [106, o.dias - 1, 'Engorde']];
      lim.forEach(([a, b, nom], k) => {
        let guia = 0; for (let d = a; d <= Math.min(b, o.dias - 1); d++) guia += Calc.etapaPorDias(d).kgSugerido;
        const f = Utils.addDays(ini, Math.min(b, o.dias));
        const kg = guia * o.ratio * vivosEn(f);
        if (kg > 0) B.gastos.push({ id: id + '-a' + k, loteId: id, fecha: f, categoria: 'alimento', descripcion: `Etapa ${k + 1}: ${nom} (ejemplo)`,
          cantidad: +(kg / 40).toFixed(2), unidad: 'sacos', kg: +kg.toFixed(1), costoUSD: +(kg * o.precioKg).toFixed(2), tasa, productoId: '', origen: 'auto' });
      });
      B.gastos.push({ id: id + '-v', loteId: id, fecha: Utils.addDays(ini, 20), categoria: 'veterinario', descripcion: 'Vacunas, hierro y desparasitante (ejemplo)',
        cantidad: 1, unidad: 'unidades', kg: 0, costoUSD: o.vet, tasa, productoId: '', origen: 'directo' });
      B.pesajes.push({ id: id + '-p1', loteId: id, fecha: Utils.addDays(ini, Math.round(o.dias / 2)), peso: Math.round((o.pesoIni + o.vivo) / 2.3) });
      B.pesajes.push({ id: id + '-p2', loteId: id, fecha: fin, peso: o.vivo });
    };

    // Ciclo 1: se dio MUY poco alimento -> cerdos livianos, ciclo largo
    ciclo({ id: 'demo-c1', nombre: 'Lote 1 (ciclo antiguo)', hace: 540, dias: 178, cant: 10, compra: 250, pesoIni: 15, vivo: 82, canal: 58, ratio: 0.72, precioKg: 0.95, vet: 22, muertes: [40, 92],
      notas: 'Racioné el alimento por falta de plata. Los cerdos salieron livianos, tardaron más de lo normal y se murieron dos. Próximo lote: ración completa.' });
    // Ciclo 2: ración completa -> el mejor
    ciclo({ id: 'demo-c2', nombre: 'Lote 2 (ración completa)', hace: 360, dias: 168, cant: 10, compra: 300, pesoIni: 15, vivo: 112, canal: 84, ratio: 0.95, precioKg: 1.0, vet: 30,
      notas: 'Ración completa en las 3 etapas, agua limpia y sal mineral al final. Mejor lote hasta ahora: buena ganancia y poca grasa.' });
    // Ciclo 3: se pasó con el alimento, murió uno al inicio, canal bajo
    ciclo({ id: 'demo-c3', nombre: 'Lote 3 (exceso de alimento)', hace: 190, dias: 170, cant: 12, compra: 420, pesoIni: 15, vivo: 108, canal: 76, ratio: 1.22, precioKg: 1.05, vet: 28, muertes: [18],
      notas: 'Me pasé con el alimento y hubo desperdicio en el comedero. Murió un lechón en las primeras semanas. Salieron con más grasa.' });

    // Ciclo 4: EN CURSO (con inventario y raciones automáticas)
    const ini4 = Utils.addDays(hoy, -60);
    B.lotes.push({ id: 'demo-lote-1', tipo: 'lote', nombre: 'Lote 4 (en curso)', fechaInicio: ini4, fechaFin: '', cantidadInicial: 10, precioCompra: 360, pesoInicial: 15 });
    B.loteActivoId = 'demo-lote-1';
    B.inventario = [
      { id: 'prod-iniciador', nombre: 'Saco Iniciador (40 kg)', categoria: 'Alimento', unidad: 'sacos', kgPorUnidad: 40, stock: 12, minimo: 2, costoProm: 40 },
      { id: 'prod-engorde', nombre: 'Saco Engorde / Desarrollo (40 kg)', categoria: 'Alimento', unidad: 'sacos', kgPorUnidad: 40, stock: 15, minimo: 2, costoProm: 38 },
      { id: 'prod-finalizador', nombre: 'Saco Finalizador (40 kg)', categoria: 'Alimento', unidad: 'sacos', kgPorUnidad: 40, stock: 10, minimo: 2, costoProm: 36 },
      { id: 'prod-vitamina', nombre: 'Frasco Hierro + Vitamina B12 (100 ml)', categoria: 'Vitamina', unidad: 'ml', kgPorUnidad: 1, stock: 80, minimo: 15, costoProm: 0.12 },
      { id: 'prod-desparasitante', nombre: 'Frasco Ivermectina Desparasitante (50 ml)', categoria: 'Medicina', unidad: 'ml', kgPorUnidad: 1, stock: 40, minimo: 10, costoProm: 0.16 },
      { id: 'prod-sal', nombre: 'Sal Mineral (kg)', categoria: 'Otros', unidad: 'kg', kgPorUnidad: 1, stock: 8, minimo: 2, costoProm: 0.50 }
    ];
    const rac = (id, prod, kg, d1, d2) => ({ id, loteId: 'demo-lote-1', productoId: prod, kgPorAnimal: kg, diaDesde: d1, diaHasta: d2, desde: ini4, aplicadoHasta: Utils.addDays(ini4, -1), activa: true });
    B.raciones = [rac('rac-1', 'prod-iniciador', 0.8, 0, 45), rac('rac-2', 'prod-engorde', 1.8, 46, 105), rac('rac-3', 'prod-finalizador', 2.6, 106, 180)];
    B.gastos.push(
      { id: 'g4-1', loteId: 'demo-lote-1', fecha: Utils.addDays(ini4, 3), categoria: 'veterinario', descripcion: 'Frasco Hierro + Vitamina B12 · 2 ml por lechón', cantidad: 20, unidad: 'ml', kg: 0, costoUSD: 2.40, tasa, productoId: 'prod-vitamina', origen: 'manual' },
      { id: 'g4-2', loteId: 'demo-lote-1', fecha: Utils.addDays(ini4, 15), categoria: 'veterinario', descripcion: 'Ivermectina · 1 ml por lechón', cantidad: 10, unidad: 'ml', kg: 0, costoUSD: 1.60, tasa, productoId: 'prod-desparasitante', origen: 'manual' });
    B.pesajes.push({ id: 'p4-1', loteId: 'demo-lote-1', fecha: Utils.addDays(ini4, 30), peso: 26 }, { id: 'p4-2', loteId: 'demo-lote-1', fecha: hoy, peso: 44 });

    Store.state = B;
    Store.normalize();
    Feed.aplicar();
    Store.save();
    UI.closeModal();
    UI.tab = 'ciclos';
    App.render();
    window.scrollTo(0, 0);
    Utils.toast('Ejemplo cargado: 3 ciclos cerrados + 1 en curso');
  },

  /* ---------- Envío de formularios (data-form) ---------- */
  forms: {
    lote(f) {
      const s = Store.state, d = Object.fromEntries(new FormData(f));
      const ind = d.tipo === 'individual';
      if (d.fechaFin && d.fechaFin < d.fechaInicio) return Utils.toast('La fecha de fin no puede ser anterior al inicio');
      const datos = {
        tipo: d.tipo, nombre: d.nombre.trim(), fechaInicio: d.fechaInicio, fechaFin: d.fechaFin || '',
        cantidadInicial: ind ? 1 : Math.max(1, parseInt(d.cantidadInicial, 10) || 1),
        precioCompra: num(d.precioCompra), pesoInicial: num(d.pesoInicial)
      };
      if (d.id) Object.assign(Store.lote(d.id), datos);
      else {
        const l = { id: Utils.uid(), ...datos };
        s.lotes.push(l); s.loteActivoId = l.id; UI.tab = 'panel';
      }
      Store.save(); UI.closeModal(); Utils.toast('Registro guardado'); App.render();
    },

    calidad(f) {
      const d = Object.fromEntries(new FormData(f)), l = Store.lote(d.id);
      if (!l) return;
      const vivo = num(d.pesoFinalVivo), canal = num(d.pesoFinalCanal);
      if (vivo <= 0 || canal <= 0) return Utils.toast('Ingresa el peso vivo y el peso sin tripas');
      if (canal >= vivo) return Utils.toast('El peso sin tripas debe ser menor al peso vivo');
      if (d.fechaFin && d.fechaFin < l.fechaInicio) return Utils.toast('La fecha de cierre no puede ser anterior al inicio');

      l.pesoFinalVivo = vivo;
      l.pesoFinalCanal = canal;
      if (d.fechaFin) l.fechaFin = d.fechaFin;
      l.notasCalidad = (d.notasCalidad || '').trim();

      const fecha_ = d.fechaFin || Utils.today();
      const previo = Store.state.pesajes.find(x => x.loteId === l.id && x.fecha === fecha_);
      if (previo) previo.peso = vivo;
      else Store.state.pesajes.push({ id: Utils.uid(), loteId: l.id, fecha: fecha_, peso: vivo });

      Store.save(); UI.closeModal(); Utils.toast('Control de calidad guardado'); App.render();
    },

    tasa(f) {
      const raw = new FormData(f).get('valor').trim();
      // Códigos privados solo para ti: 9999 activa el Demo, 0000 borra todo de fábrica
      if (raw === '9999') { App.instalarDemo(); return; }
      if (raw === '0000') {
        try { localStorage.removeItem(Store.KEY); localStorage.removeItem(Store.OLD_KEY); } catch (e) { /* sin acceso */ }
        Store.state = Store.blank();
        UI.tab = 'panel'; UI.regTab = 'uso'; UI.usoProducto = '';
        Store.save(); UI.closeModal(); App.render(); Utils.toast('Datos reiniciados de fábrica');
        return;
      }

      const v = num(raw);
      if (v <= 0) return Utils.toast('Ingresa una tasa válida');
      Store.state.tasa = { valor: v, fecha: Utils.today() };
      Store.save(); UI.closeModal(); Utils.toast('Tasa actualizada'); App.render();
    },

    /** Uso MANUAL de inventario (Soporta dosis pequeñas en ml y kilos de un saco) */
    uso(f) {
      const l = Store.lote(); if (!l) return;
      const d = Object.fromEntries(new FormData(f)), p = Store.producto(d.productoId), cantInput = num(d.cantidad);
      if (!p || cantInput <= 0) return Utils.toast('Indica la cantidad usada');

      const esKgDeSaco = (d.modoUso === 'kgSaco' && p.unidad === 'sacos');
      const cant = esKgDeSaco ? cantInput / (p.kgPorUnidad || 40) : cantInput;

      if (cant > p.stock && !confirm(`Solo quedan ${dec(p.stock, 2)} ${p.unidad} en inventario. ¿Descontar lo que queda?`)) return;
      const usada = Math.min(cant, p.stock);
      p.stock = Math.max(0, p.stock - usada);
      UI.usoProducto = p.id;

      const descExtra = esKgDeSaco ? ` (${dec(cantInput, 2)} kg)` : '';
      Store.state.gastos.push({
        id: Utils.uid(), loteId: l.id, fecha: d.fecha, categoria: Views.catGastoDe(p.categoria),
        descripcion: d.nota.trim() ? `${p.nombre}${descExtra} · ${d.nota.trim()}` : `${p.nombre}${descExtra}`,
        cantidad: usada, unidad: p.unidad, kg: p.categoria === 'Alimento' ? usada * (p.kgPorUnidad || 40) : 0,
        costoUSD: usada * (p.costoProm || 0), tasa: Store.state.tasa.valor || 0, productoId: p.id, origen: 'manual'
      });
      Store.save(); Utils.toast('Dosis / Uso descontado del inventario'); App.render();
      if (Calc.estadoProducto(p).nivel !== 'ok') setTimeout(() => Utils.toast(`Poco ${p.nombre}: comprar de nuevo`), 2700);
    },

    /** Gasto directo (sin inventario) */
    gasto(f) {
      const l = Store.lote(); if (!l) return;
      const d = Object.fromEntries(new FormData(f)), cant = num(d.cantidad);
      Store.state.gastos.push({
        id: Utils.uid(), loteId: l.id, fecha: d.fecha, categoria: d.categoria, descripcion: d.descripcion.trim(),
        cantidad: cant, unidad: d.unidad, kg: d.categoria === 'alimento' ? (d.unidad === 'kg' ? cant : d.unidad === 'sacos' ? cant * 40 : 0) : 0,
        costoUSD: num(d.costoUSD), tasa: Store.state.tasa.valor || 0, productoId: '', origen: 'directo'
      });
      Store.save(); Utils.toast('Gasto guardado'); App.render();
    },

    baja(f) {
      const l = Store.lote(); if (!l) return;
      const d = Object.fromEntries(new FormData(f)), cant = parseInt(d.cantidad, 10) || 0, c = Calc.lote(l);
      if (cant < 1) return Utils.toast('Cantidad inválida');
      if (cant > c.vivos) return Utils.toast(`Solo hay ${c.vivos} animal(es) vivo(s)`);
      Store.state.bajas.push({
        id: Utils.uid(), loteId: l.id, fecha: d.fecha, cantidad: cant, motivo: d.motivo,
        ingresoUSD: d.motivo === 'venta' ? num(d.ingresoUSD) : 0, nota: d.nota.trim()
      });
      Store.save(); Utils.toast('Baja registrada'); App.render();
    },

    peso(f) {
      const l = Store.lote(); if (!l) return;
      const d = Object.fromEntries(new FormData(f)), peso = num(d.peso);
      if (peso <= 0) return Utils.toast('Ingresa un peso válido');
      const fecha_ = d.fecha || Utils.today();
      const previo = Store.state.pesajes.find(x => x.loteId === l.id && x.fecha === fecha_);
      if (previo) previo.peso = peso;
      else Store.state.pesajes.push({ id: Utils.uid(), loteId: l.id, fecha: fecha_, peso });
      Store.save(); Utils.toast('Peso guardado'); App.render();
    },

    /** Ración diaria automática por etapas */
    racion(f) {
      const l = Store.lote(); if (!l) return;
      const d = Object.fromEntries(new FormData(f)), kg = num(d.kgPorAnimal);
      if (!d.productoId || kg <= 0) return Utils.toast('Indica el alimento y los kg por animal');
      const rango = rangoEtapa(d.etapaRacion || 'todas');
      const desde = d.desde < l.fechaInicio ? l.fechaInicio : d.desde;

      Store.state.raciones.push({
        id: Utils.uid(), loteId: l.id, productoId: d.productoId, kgPorAnimal: kg,
        diaDesde: rango.diaDesde, diaHasta: rango.diaHasta,
        desde, aplicadoHasta: Utils.addDays(desde, -1), activa: true
      });
      const r = Feed.aplicar();
      Store.save();
      Utils.toast(r.dias ? `Etapa activada · ${r.dias} día(s) descontados` : 'Etapa programada: se descontará sola en sus días');
      App.render();
    },

    racionEdit(f) {
      const d = Object.fromEntries(new FormData(f)), kg = num(d.kgPorAnimal), r = Store.racion(d.id);
      if (!r || kg <= 0) return Utils.toast('Cantidad inválida');
      const rango = rangoEtapa(d.etapaRacion || 'todas');
      r.kgPorAnimal = kg;
      r.diaDesde = rango.diaDesde;
      r.diaHasta = rango.diaHasta;
      Store.save(); Feed.aplicar(); UI.closeModal(); Utils.toast('Ración actualizada'); App.render();
    },

    producto(f) {
      const d = Object.fromEntries(new FormData(f));
      const esSaco = d.unidad === 'sacos';
      const kgPU = esSaco ? (Math.max(1, num(d.kgPorUnidad)) || 40) : 1;
      if (d.id) {
        Object.assign(Store.producto(d.id), {
          nombre: d.nombre.trim(), categoria: d.categoria, unidad: d.unidad, minimo: num(d.minimo), kgPorUnidad: kgPU
        });
      } else {
        const stock = num(d.stock);
        const costoTotal = num(d.costoInicial);
        Store.state.inventario.push({
          id: Utils.uid(), nombre: d.nombre.trim(), categoria: d.categoria, unidad: d.unidad, kgPorUnidad: kgPU,
          stock, minimo: num(d.minimo), costoProm: stock > 0 ? costoTotal / stock : 0
        });
      }
      Store.save(); UI.closeModal(); Utils.toast('Producto guardado correctamente'); App.render();
    },

    compra(f) {
      const d = Object.fromEntries(new FormData(f)), p = Store.producto(d.productoId);
      const cant = num(d.cantidad), costo = num(d.costoUSD);
      if (!p || cant <= 0) return Utils.toast('Cantidad inválida');
      const valorPrevio = p.stock * (p.costoProm || 0);
      p.stock += cant;
      p.costoProm = (valorPrevio + costo) / p.stock;
      Store.state.compras.push({ id: Utils.uid(), productoId: p.id, fecha: d.fecha, cantidad: cant, costoUSD: costo });
      Store.save(); UI.closeModal(); Utils.toast('Inventario actualizado'); App.render();
    }
  },

  /* ---------- Eventos globales (delegación) ---------- */
  bind() {
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      if (el.dataset.backdrop && e.target !== el) return;
      const fn = App.actions[el.dataset.action];
      if (fn) fn(el);
    });

    document.addEventListener('submit', e => {
      const f = e.target.closest('form[data-form]'); if (!f) return;
      e.preventDefault();
      const fn = App.forms[f.dataset.form];
      if (fn) fn(f);
    });

    document.addEventListener('change', e => {
      const t = e.target;
      if (t.matches('[data-change="selLote"]')) { Store.state.loteActivoId = t.value; Store.save(); App.render(); return; }
      if (t.matches('[data-change="importar"]')) { App.importar(t); return; }

      const form = t.closest('form[data-form]');
      if (form && form.dataset.form === 'lote' && t.name === 'tipo') form.dataset.tipo = t.value;
      if (form && (form.dataset.form === 'racion' || form.dataset.form === 'racionEdit') && t.name === 'etapaRacion') {
        const sugeridos = { '1': 0.8, '2': 1.8, '3': 2.6 };
        if (sugeridos[t.value]) form.kgPorAnimal.value = sugeridos[t.value];
      }
      if (form && form.dataset.form === 'producto') {
        if (t.name === 'categoria') {
          if (t.value === 'Alimento') { form.unidad.value = 'sacos'; form.kgPorUnidad.value = 40; }
          else if (t.value === 'Vitamina' || t.value === 'Medicina' || t.value === 'Vacuna') { form.unidad.value = 'ml'; form.kgPorUnidad.value = 1; }
          else { form.unidad.value = 'kg'; form.kgPorUnidad.value = 1; }
        }
        if (t.name === 'unidad') {
          if (t.value === 'sacos') form.kgPorUnidad.value = 40;
          else form.kgPorUnidad.value = 1;
        }
      }
      App.sync();
    });

    document.addEventListener('input', () => App.sync());

    document.addEventListener('visibilitychange', () => { if (!document.hidden) App.aplicarRaciones(); });
  },

  importar(input) {
    const file = input.files[0]; if (!file) return;
    const lector = new FileReader();
    lector.onload = () => {
      try {
        if (!confirm('Esto reemplaza los datos actuales por los del respaldo. ¿Continuar?')) return;
        Store.importJSON(lector.result);
        Utils.toast('Respaldo importado'); App.render();
      } catch (err) { Utils.toast('Archivo de respaldo inválido'); }
    };
    lector.readAsText(file);
    input.value = '';
  },

  aplicarRaciones() {
    const r = Feed.aplicar();
    if (r.dias) { App.render(); Utils.toast(`Ración diaria aplicada (${r.dias} día${r.dias > 1 ? 's' : ''})`); }
    if (r.faltante) setTimeout(() => Utils.toast('Alimento insuficiente: registra una compra'), 2800);
  },

  pwa() {
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      const tenia = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (tenia && !App._recargado) { App._recargado = true; location.reload(); }   // toma la versión nueva sola
      });
      navigator.serviceWorker.register('sw.js').then(r => r.update()).catch(() => {});
    }
  },

  init() {
    Store.load();
    App.bind();
    App.render();
    App.aplicarRaciones();
    App.pwa();
    setInterval(() => App.aplicarRaciones(), 10 * 60 * 1000);
  }
};

App.init();
