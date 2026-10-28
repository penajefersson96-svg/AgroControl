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

  /* ---------- Generador del DEMO PRIVADO (Solo accesible con código 9999 en Tasa BCV) ---------- */
  instalarDemo() {
    const hoy = Utils.today();
    const inicioLote1 = Utils.addDays(hoy, -60);
    const inicioLote2 = Utils.addDays(hoy, -165);
    const finLote2 = Utils.addDays(hoy, -3);

    Store.state = {
      tasa: { valor: 45.50, fecha: hoy },
      loteActivoId: 'demo-lote-1',
      lotes: [
        {
          id: 'demo-lote-1',
          tipo: 'lote',
          nombre: 'Lote 01 (En cría · Mes 2)',
          fechaInicio: inicioLote1,
          fechaFin: '',
          cantidadInicial: 10,
          precioCompra: 350,
          pesoInicial: 10
        },
        {
          id: 'demo-lote-2',
          tipo: 'lote',
          nombre: 'Lote Anterior (Cerrado 5.5 meses)',
          fechaInicio: inicioLote2,
          fechaFin: finLote2,
          cantidadInicial: 8,
          precioCompra: 280,
          pesoInicial: 10,
          pesoFinalVivo: 94,
          pesoFinalCanal: 71.5,
          notasCalidad: 'Buena conversión con el saco de Iniciador los primeros 45 días. En la etapa final se les mezcló sal mineral y salieron con poca grasa y buen rendimiento en canal.'
        }
      ],
      inventario: [
        {
          id: 'prod-iniciador',
          nombre: 'Saco Iniciador (40 kg)',
          categoria: 'Alimento',
          unidad: 'sacos',
          kgPorUnidad: 40,
          stock: 12,
          minimo: 2,
          costoProm: 40
        },
        {
          id: 'prod-engorde',
          nombre: 'Saco Engorde / Desarrollo (40 kg)',
          categoria: 'Alimento',
          unidad: 'sacos',
          kgPorUnidad: 40,
          stock: 15,
          minimo: 2,
          costoProm: 38
        },
        {
          id: 'prod-finalizador',
          nombre: 'Saco Finalizador (40 kg)',
          categoria: 'Alimento',
          unidad: 'sacos',
          kgPorUnidad: 40,
          stock: 10,
          minimo: 2,
          costoProm: 36
        },
        {
          id: 'prod-vitamina',
          nombre: 'Frasco Hierro + Vitamina B12 (100 ml)',
          categoria: 'Vitamina',
          unidad: 'ml',
          kgPorUnidad: 1,
          stock: 80,
          minimo: 15,
          costoProm: 0.12
        },
        {
          id: 'prod-desparasitante',
          nombre: 'Frasco Ivermectina Desparasitante (50 ml)',
          categoria: 'Medicina',
          unidad: 'ml',
          kgPorUnidad: 1,
          stock: 40,
          minimo: 10,
          costoProm: 0.16
        },
        {
          id: 'prod-sal',
          nombre: 'Sal Mineral (kg)',
          categoria: 'Otros',
          unidad: 'kg',
          kgPorUnidad: 1,
          stock: 8,
          minimo: 2,
          costoProm: 0.50
        }
      ],
      compras: [],
      raciones: [
        {
          id: 'rac-1', loteId: 'demo-lote-1', productoId: 'prod-iniciador',
          kgPorAnimal: 0.8, diaDesde: 0, diaHasta: 45,
          desde: inicioLote1, aplicadoHasta: Utils.addDays(inicioLote1, -1), activa: true
        },
        {
          id: 'rac-2', loteId: 'demo-lote-1', productoId: 'prod-engorde',
          kgPorAnimal: 1.8, diaDesde: 46, diaHasta: 105,
          desde: inicioLote1, aplicadoHasta: Utils.addDays(inicioLote1, -1), activa: true
        },
        {
          id: 'rac-3', loteId: 'demo-lote-1', productoId: 'prod-finalizador',
          kgPorAnimal: 2.6, diaDesde: 106, diaHasta: 180,
          desde: inicioLote1, aplicadoHasta: Utils.addDays(inicioLote1, -1), activa: true
        }
      ],
      gastos: [
        {
          id: 'g-demo-1', loteId: 'demo-lote-1', fecha: Utils.addDays(inicioLote1, 3),
          categoria: 'veterinario', descripcion: 'Frasco Hierro + Vitamina B12 · Dosis 2 ml por lechón',
          cantidad: 20, unidad: 'ml', kg: 0, costoUSD: 2.40, tasa: 45.50, productoId: 'prod-vitamina', origen: 'manual'
        },
        {
          id: 'g-demo-2', loteId: 'demo-lote-1', fecha: Utils.addDays(inicioLote1, 15),
          categoria: 'veterinario', descripcion: 'Frasco Ivermectina Desparasitante · Dosis 1 ml por lechón',
          cantidad: 10, unidad: 'ml', kg: 0, costoUSD: 1.60, tasa: 45.50, productoId: 'prod-desparasitante', origen: 'manual'
        },
        {
          id: 'g-demo-3', loteId: 'demo-lote-1', fecha: Utils.addDays(inicioLote1, 30),
          categoria: 'varios', descripcion: 'Sal Mineral (kg) · Mezclada en comedero',
          cantidad: 2, unidad: 'kg', kg: 0, costoUSD: 1.00, tasa: 45.50, productoId: 'prod-sal', origen: 'manual'
        },
        {
          id: 'g-l2-1', loteId: 'demo-lote-2', fecha: Utils.addDays(inicioLote2, 45),
          categoria: 'alimento', descripcion: 'Etapa 1: 9 sacos Iniciador',
          cantidad: 9, unidad: 'sacos', kg: 360, costoUSD: 360, tasa: 45.50, productoId: '', origen: 'auto'
        },
        {
          id: 'g-l2-2', loteId: 'demo-lote-2', fecha: Utils.addDays(inicioLote2, 105),
          categoria: 'alimento', descripcion: 'Etapa 2: 21 sacos Engorde',
          cantidad: 21, unidad: 'sacos', kg: 840, costoUSD: 798, tasa: 45.50, productoId: '', origen: 'auto'
        },
        {
          id: 'g-l2-3', loteId: 'demo-lote-2', fecha: finLote2,
          categoria: 'alimento', descripcion: 'Etapa 3: 28 sacos Finalizador',
          cantidad: 28, unidad: 'sacos', kg: 1120, costoUSD: 1008, tasa: 45.50, productoId: '', origen: 'auto'
        },
        {
          id: 'g-l2-4', loteId: 'demo-lote-2', fecha: finLote2,
          categoria: 'veterinario', descripcion: 'Vitaminas, hierro, desparasitante y sal del ciclo',
          cantidad: 1, unidad: 'unidades', kg: 0, costoUSD: 28, tasa: 45.50, productoId: '', origen: 'manual'
        }
      ],
      bajas: [],
      pesajes: [
        { id: 'pes-1', loteId: 'demo-lote-1', fecha: Utils.addDays(inicioLote1, 30), peso: 22 },
        { id: 'pes-2', loteId: 'demo-lote-1', fecha: hoy, peso: 38 },
        { id: 'pes-3', loteId: 'demo-lote-2', fecha: finLote2, peso: 94 }
      ]
    };

    Feed.aplicar();
    Store.save();
    UI.closeModal();
    UI.tab = 'panel';
    App.render();
    Utils.toast('Modo prueba activado');
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
        localStorage.clear();
        Store.state = { tasa: { valor: 0, fecha: '' }, loteActivoId: '', lotes: [], inventario: [], compras: [], gastos: [], bajas: [], pesajes: [], raciones: [] };
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
        cantidad: cant, unidad: d.unidad, kg: (d.categoria === 'alimento' && d.unidad === 'kg') ? cant : 0,
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
      navigator.serviceWorker.register('sw.js').catch(() => {});
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
