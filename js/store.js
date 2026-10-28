/* =====================================================================
   store.js — datos y persistencia local (localStorage)
   Todo queda guardado en el teléfono; no requiere internet.
   ===================================================================== */
'use strict';

const Store = {
  KEY: 'agrocontrol.v2',
  OLD_KEY: 'agrocontrol.v1',
  state: null,

  /** Estructura vacía de la base de datos local */
  blank: () => ({
    version: 2,
    // tipo: 'lote' | 'individual'
    lotes: [],        // {id,tipo,nombre,fechaInicio,fechaFin,cantidadInicial,precioCompra,pesoInicial}
    pesajes: [],      // {id,loteId,fecha,peso}  (peso promedio por animal, kg)
    gastos: [],       // {id,loteId,fecha,categoria,descripcion,cantidad,unidad,kg,costoUSD,tasa,productoId,origen}
    bajas: [],        // {id,loteId,fecha,cantidad,motivo,ingresoUSD,nota}
    inventario: [],   // {id,nombre,categoria,unidad,kgPorUnidad,stock,minimo,costoProm}
    compras: [],      // {id,productoId,fecha,cantidad,costoUSD}
    raciones: [],     // {id,loteId,productoId,kgPorAnimal,desde,aplicadoHasta,activa}
    tasa: { valor: 0, fecha: '' },
    loteActivoId: null
  }),

  load() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(this.KEY)); } catch (e) { /* vacío */ }
    if (!raw) {
      // Migración desde la primera versión de la app
      try { const old = JSON.parse(localStorage.getItem(this.OLD_KEY)); if (old) raw = this.migrate(old); } catch (e) { /* sin datos previos */ }
    }
    this.state = { ...this.blank(), ...(raw || {}) };
    this.normalize();
  },

  migrate(old) {
    const pesajes = [];
    (old.lotes || []).forEach(l => {
      if (l.pesoPromedio > 0) pesajes.push({ id: Utils.uid(), loteId: l.id, fecha: Utils.today(), peso: l.pesoPromedio });
    });
    return { ...old, pesajes };
  },

  /** Completa campos que puedan faltar (datos antiguos o importados) */
  normalize() {
    const s = this.state;
    s.lotes.forEach(l => {
      l.tipo = l.tipo || 'lote';
      l.fechaFin = l.fechaFin || '';
      l.pesoInicial = l.pesoInicial || 0;
    });
    s.inventario.forEach(p => {
      if (!p.kgPorUnidad) p.kgPorUnidad = p.unidad === 'sacos' ? 40 : 1;
    });
    if (!s.lotes.find(l => l.id === s.loteActivoId)) s.loteActivoId = s.lotes[0] ? s.lotes[0].id : null;
  },

  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.state)); }
    catch (e) { Utils.toast('No se pudo guardar: almacenamiento lleno'); }
  },

  /* ---- Respaldo ---- */
  exportJSON() {
    const blob = new Blob([JSON.stringify(this.state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `agrocontrol-respaldo-${Utils.today()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  importJSON(texto) {
    const data = JSON.parse(texto);
    if (!data || !Array.isArray(data.lotes)) throw new Error('Archivo inválido');
    this.state = { ...this.blank(), ...data };
    this.normalize();
    this.save();
  },

  /* ---- Búsquedas ---- */
  lote(id) { return this.state.lotes.find(l => l.id === (id === undefined ? this.state.loteActivoId : id)); },
  producto(id) { return this.state.inventario.find(p => p.id === id); },
  racion(id) { return this.state.raciones.find(r => r.id === id); }
};
