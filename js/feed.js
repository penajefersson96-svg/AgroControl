/* =====================================================================
   feed.js — descuento AUTOMÁTICO diario de la ración
   Soporta ración fija o programada por etapa (diaDesde / diaHasta)
   y cálculo automático de consumo diario según la edad del cerdo.
   ===================================================================== */
'use strict';

const Feed = {
  /** Aplica los días pendientes de todas las raciones activas. Devuelve {dias, faltante} */
  aplicar() {
    const s = Store.state, hoy = Utils.today();
    let dias = 0, faltante = false, cambio = false;

    s.raciones.forEach(r => {
      if (!r.activa) return;
      const lote = Store.lote(r.loteId), p = Store.producto(r.productoId);
      if (!lote || !p) return;

      // No se aplica después de la fecha fin del lote
      const limite = (lote.fechaFin && lote.fechaFin < hoy) ? lote.fechaFin : hoy;
      let dia = Utils.addDays(r.aplicadoHasta, 1);
      if (dia < lote.fechaInicio) dia = lote.fechaInicio;
      const previo = r.aplicadoHasta;
      let guarda = 0; // protección: máx. 400 días por ejecución

      while (dia <= limite && guarda < 400) {
        const diasCriando = Math.max(0, Utils.diffDays(lote.fechaInicio, dia));

        // Verifica si la ración tiene límite de días por etapa (ej. Iniciador día 0 a 45)
        const enRango = (r.diaDesde == null || diasCriando >= r.diaDesde) &&
                        (r.diaHasta == null || diasCriando <= r.diaHasta);

        const vivos = Calc.vivosEn(lote, dia);
        if (vivos > 0 && enRango) {
          const kgPU = p.kgPorUnidad || 1;
          // Si la ración tiene modo autoEtapa, usa la curva de crecimiento; si no, usa el kg fijo
          const kgAnimalHoy = r.autoEtapa ? Calc.etapaPorDias(diasCriando).kgSugerido : (r.kgPorAnimal || 0);
          const necesarias = (kgAnimalHoy * vivos) / kgPU;   // en unidades del producto
          const usadas = Math.min(necesarias, p.stock);

          if (usadas < necesarias) faltante = true;
          if (usadas > 0) {
            p.stock = Math.max(0, p.stock - usadas);
            s.gastos.push({
              id: Utils.uid(), loteId: lote.id, fecha: dia, categoria: 'alimento',
              descripcion: `Ración (${Calc.etapaPorDias(diasCriando).nombre}) · ${p.nombre}`,
              cantidad: usadas, unidad: p.unidad, kg: usadas * kgPU,
              costoUSD: usadas * (p.costoProm || 0), tasa: s.tasa.valor || 0,
              productoId: p.id, origen: 'auto'
            });
          }
          dias++;
        }
        r.aplicadoHasta = dia;
        dia = Utils.addDays(dia, 1);
        guarda++;
      }
      // Si el lote ya terminó o el día no tuvo animales, se avanza el marcador igualmente
      if (limite > r.aplicadoHasta && dia > limite) r.aplicadoHasta = limite;
      if (r.aplicadoHasta !== previo) cambio = true;
    });

    if (dias || cambio) Store.save();
    return { dias, faltante };
  }
};
