/* =====================================================================
   calc.js — todos los cálculos (costos, etapas, animales, canal, inventario)
   ===================================================================== */
'use strict';

const Calc = {
  sum: (arr, campo) => arr.reduce((a, x) => a + (x[campo] || 0), 0),

  /** 
   * Tabla guía de las 3 etapas del cerdo (ciclo de 5 a 6 meses / 150-180 días en granja)
   * Devuelve qué alimento toca, cuánto come diario y qué peso debería tener.
   */
  etapaPorDias(dias) {
    if (dias <= 20) {
      return { codigo: 'iniciador', nombre: 'Iniciador (Fase 1)', alimento: 'Iniciador', kgSugerido: 0.6, metaPeso: '7 - 15 kg', etapaNum: 1 };
    }
    if (dias <= 45) {
      return { codigo: 'iniciador', nombre: 'Iniciador (Fase 2)', alimento: 'Iniciador', kgSugerido: 1.0, metaPeso: '15 - 28 kg', etapaNum: 1 };
    }
    if (dias <= 75) {
      return { codigo: 'desarrollo', nombre: 'Desarrollo (Mes 2-3)', alimento: 'Desarrollo / Crecimiento', kgSugerido: 1.6, metaPeso: '28 - 45 kg', etapaNum: 2 };
    }
    if (dias <= 105) {
      return { codigo: 'desarrollo', nombre: 'Desarrollo (Mes 3-4)', alimento: 'Desarrollo / Crecimiento', kgSugerido: 2.1, metaPeso: '45 - 65 kg', etapaNum: 2 };
    }
    if (dias <= 135) {
      return { codigo: 'engorde', nombre: 'Engorde (Mes 4-5)', alimento: 'Engorde / Finalizador', kgSugerido: 2.5, metaPeso: '65 - 85 kg', etapaNum: 3 };
    }
    return { codigo: 'engorde', nombre: 'Engorde Final (Mes 5-6)', alimento: 'Engorde / Finalizador', kgSugerido: 2.8, metaPeso: '85 - 100+ kg', etapaNum: 3 };
  },

  /** Animales vivos de un lote en una fecha dada */
  vivosEn(lote, fecha) {
    const bajas = Store.state.bajas.filter(b => b.loteId === lote.id && b.fecha <= fecha);
    return Math.max(0, lote.cantidadInicial - Calc.sum(bajas, 'cantidad'));
  },

  pesajes: loteId => Store.state.pesajes.filter(p => p.loteId === loteId).sort((a, b) => a.fecha.localeCompare(b.fecha)),

  /** programado | activo | finalizado */
  estadoLote(l) {
    const hoy = Utils.today();
    if (l.fechaInicio > hoy) return 'programado';
    if (l.fechaFin && l.fechaFin < hoy) return 'finalizado';
    return 'activo';
  },

  raciones: loteId => Store.state.raciones.filter(r => r.loteId === loteId),

  /** Kg de alimento por día que consume hoy el lote según sus raciones activas */
  consumoKg(l) {
    if (Calc.estadoLote(l) === 'finalizado') return 0;
    const hoy = Utils.today();
    const vivos = Calc.vivosEn(l, hoy);
    const dias = Math.max(0, Utils.diffDays(l.fechaInicio, hoy));

    return Calc.raciones(l.id).filter(r => r.activa).reduce((a, r) => {
      const enRango = (r.diaDesde == null || dias >= r.diaDesde) && (r.diaHasta == null || dias <= r.diaHasta);
      if (!enRango) return a;
      const kgDia = r.autoEtapa ? Calc.etapaPorDias(dias).kgSugerido : (r.kgPorAnimal || 0);
      return a + (kgDia * vivos);
    }, 0);
  },

  /** Métricas completas de un lote o cerdo individual */
  lote(l) {
    const s = Store.state, hoy = Utils.today();
    const gastos = s.gastos.filter(x => x.loteId === l.id);
    const bajas = s.bajas.filter(x => x.loteId === l.id);
    const porCat = c => Calc.sum(gastos.filter(x => x.categoria === c), 'costoUSD');

    const alimento = porCat('alimento'), vet = porCat('veterinario'), varios = porCat('varios');
    const compra = l.precioCompra || 0;
    const total = compra + alimento + vet + varios;

    const muertos = Calc.sum(bajas.filter(x => x.motivo === 'muerte'), 'cantidad');
    const vendidos = Calc.sum(bajas.filter(x => x.motivo === 'venta'), 'cantidad');
    const vivos = Math.max(0, l.cantidadInicial - muertos - vendidos);

    // Si el lote ya se mató/cerró y no quedan vivos en corral, usamos los animales logrados para el cálculo final
    const animalesBase = vivos > 0 ? vivos : Math.max(1, l.cantidadInicial - muertos);

    const pes = Calc.pesajes(l.id), ult = pes[pes.length - 1];
    const peso = l.pesoFinalVivo || (ult ? ult.peso : 0); // Peso en pie (completo con tripas: ej. 80-100 kg)
    const kilos = animalesBase * peso;

    // --- CONTROL DE CALIDAD: Peso en Canal (sin tripas/vísceras) ---
    // Si el usuario aún no anota cuánto pesó sin tripas al matar, se estima el 75% (merma normal de 25% de tripas)
    const pesoCanal = l.pesoFinalCanal ? l.pesoFinalCanal : (peso > 0 ? +(peso * 0.75).toFixed(1) : 0);
    const kilosCanal = animalesBase * pesoCanal;
    const rendimientoCanal = (peso > 0 && pesoCanal > 0) ? (pesoCanal / peso) * 100 : 0; // % que quedó de carne y hueso
    const mermaTripasKg = peso > 0 ? Math.max(0, peso - pesoCanal) : 0;

    // --- TIEMPO Y ETAPA DEL CICLO (5 a 6 meses = 150 a 180 días) ---
    const estado = Calc.estadoLote(l);
    const ref = (l.fechaFin && l.fechaFin < hoy) ? l.fechaFin : hoy;
    const dias = Math.max(0, Utils.diffDays(l.fechaInicio, ref));
    const semanas = Math.floor(dias / 7);
    const meses = +(dias / 30.4).toFixed(1);
    const totalDias = l.fechaFin ? Math.max(1, Utils.diffDays(l.fechaInicio, l.fechaFin)) : 165; // 165 días (5.5 meses) por defecto
    const restantes = l.fechaFin ? Math.max(0, Utils.diffDays(hoy, l.fechaFin)) : Math.max(0, 165 - dias);
    const etapaActual = Calc.etapaPorDias(dias);

    // Rendimiento de alimento
    const kgAlimento = Calc.sum(gastos.filter(x => x.categoria === 'alimento'), 'kg');
    const ganado = (peso > 0 && l.pesoInicial > 0) ? peso - l.pesoInicial : 0;
    const diasPeso = ult ? Utils.diffDays(l.fechaInicio, ult.fecha) : dias;
    const gdp = (ganado > 0 && diasPeso > 0) ? (ganado / diasPeso) * 1000 : 0;             // g/día
    const fcr = (ganado > 0 && kgAlimento > 0 && animalesBase > 0) ? kgAlimento / (ganado * animalesBase) : 0;

    const tasa = s.tasa.valor || 0;
    return {
      compra, alimento, vet, varios, total, muertos, vendidos, vivos, peso, kilos, tasa,
      // Datos nuevos de tiempo y etapa:
      estado, dias, semanas, meses, totalDias, restantes, etapaActual,
      progreso: totalDias ? Math.min(100, (dias / totalDias) * 100) : 0,
      // Datos nuevos de control de calidad al matar (con tripas vs sin tripas):
      pesoCanal, kilosCanal, rendimientoCanal, mermaTripasKg,
      tieneCanalReal: Boolean(l.pesoFinalCanal),
      costoKgCanal: kilosCanal ? total / kilosCanal : 0,
      // Métricas estándar:
      kgAlimento, gdp, fcr,
      consumoKg: Calc.consumoKg(l),
      consumoSugeridoLote: +(etapaActual.kgSugerido * vivos).toFixed(1),
      porAnimal: animalesBase ? total / animalesBase : 0,
      costoKg: kilos ? total / kilos : 0,
      ingresosVentas: Calc.sum(bajas, 'ingresoUSD'),
      totalBs: total * tasa,
      mortalidad: l.cantidadInicial ? (muertos / l.cantidadInicial) * 100 : 0
    };
  },

  /* ---------------- Inventario ---------------- */

  /** Unidades por día que consumen todas las raciones activas de un producto */
  consumoProducto(p) {
    const hoy = Utils.today();
    let u = 0;
    Store.state.raciones.forEach(r => {
      if (!r.activa || r.productoId !== p.id) return;
      const l = Store.lote(r.loteId);
      if (!l || Calc.estadoLote(l) === 'finalizado') return;
      const dias = Math.max(0, Utils.diffDays(l.fechaInicio, hoy));
      const enRango = (r.diaDesde == null || dias >= r.diaDesde) && (r.diaHasta == null || dias <= r.diaHasta);
      if (!enRango) return;
      const kgDia = r.autoEtapa ? Calc.etapaPorDias(dias).kgSugerido : (r.kgPorAnimal || 0);
      u += (kgDia * Calc.vivosEn(l, hoy)) / (p.kgPorUnidad || 1);
    });
    return u;
  },

  /** Estado de existencias: nivel (ok | bajo | agotado) y días restantes estimados */
  estadoProducto(p) {
    const consumo = Calc.consumoProducto(p);
    const dias = consumo > 0 ? p.stock / consumo : null;
    let nivel = 'ok';
    if (p.stock <= 0) nivel = 'agotado';
    else if (p.stock <= p.minimo || (dias !== null && dias <= 3)) nivel = 'bajo';
    return { nivel, dias, consumo };
  },

  alertas() {
    return Store.state.inventario
      .map(p => ({ p, e: Calc.estadoProducto(p) }))
      .filter(x => x.e.nivel !== 'ok');
  }
};
