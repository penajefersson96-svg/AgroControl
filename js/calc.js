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


  /* ---------------- Estadística por ciclo ---------------- */

  /** Lotes ordenados del más antiguo al más reciente */
  ciclosOrdenados() {
    return Store.state.lotes.slice().sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));
  },

  /** Ciclo inmediatamente anterior a un lote (por fecha de inicio) */
  cicloAnterior(l) {
    const ord = Calc.ciclosOrdenados(), i = ord.findIndex(x => x.id === l.id);
    return i > 0 ? ord[i - 1] : null;
  },

  /** Resumen comparable de un ciclo: alimento real vs guía por etapa, ganancia, conversión, canal, costos */
  ciclo(l) {
    const c = Calc.lote(l);
    const etapas = [1, 2, 3].map(n => ({ n, real: 0, guia: 0 }));
    Store.state.gastos
      .filter(g => g.loteId === l.id && g.categoria === 'alimento' && g.kg > 0)
      .forEach(g => {
        const d = Math.max(0, Utils.diffDays(l.fechaInicio, g.fecha));
        etapas[Calc.etapaPorDias(d).etapaNum - 1].real += g.kg / Math.max(1, Calc.vivosEn(l, g.fecha));
      });
    for (let d = 0; d < c.dias; d++) {
      const e = Calc.etapaPorDias(d);
      etapas[e.etapaNum - 1].guia += e.kgSugerido;
    }
    const kgCerdo = Calc.sum(etapas, 'real'), guiaCerdo = Calc.sum(etapas, 'guia');
    return {
      l, c, etapas, kgCerdo, guiaCerdo,
      ratio: (kgCerdo > 0 && guiaCerdo > 0) ? kgCerdo / guiaCerdo : 0,
      dias: c.dias, animales: c.vivos > 0 ? c.vivos : Math.max(1, l.cantidadInicial - c.muertos),
      pesoVivo: c.peso, pesoCanal: c.peso ? c.pesoCanal : 0, canalReal: c.tieneCanalReal,
      rend: c.peso ? c.rendimientoCanal : 0, gdp: c.gdp, fcr: c.fcr, mort: c.mortalidad,
      costoAnimal: c.porAnimal, costoKg: c.costoKg, costoKgCanal: c.costoKgCanal, total: c.total,
      suficiente: c.dias >= 14          // con menos de 2 semanas aún no hay conclusiones útiles
    };
  },

  /**
   * Lectura automática del ciclo: qué salió bien, qué falló y qué hacer en el siguiente.
   * Cada hallazgo: { tono: ok|warn|crit|info, texto, accion? }
   */
  hallazgos(ci, prev) {
    const h = [], f = (n, d = 1) => dec(n, d), pct = n => Math.round(n * 100);
    if (!ci.suficiente) {
      return [{ tono: 'info', texto: 'Este ciclo lleva menos de 14 días: aún es pronto para sacar conclusiones.' }];
    }

    // 1) Alimento real contra la guía de cada etapa
    if (ci.ratio > 0) {
      const poca = ci.ratio < 0.9, mucha = ci.ratio > 1.1;
      const peor = ci.etapas.filter(e => e.guia > 0 && e.real > 0).sort((a, b) => a.real / a.guia - b.real / b.guia)[0];
      const nomEtapa = { 1: 'Iniciador', 2: 'Desarrollo', 3: 'Engorde' };
      if (poca) {
        const lenta = ci.gdp > 0 && ci.gdp < 550;
        h.push({
          tono: lenta ? 'crit' : 'warn',
          texto: `Diste ${pct(ci.ratio)}% de la guía de alimento (${f(ci.kgCerdo)} kg por cerdo contra ${f(ci.guiaCerdo)} kg sugeridos)${peor ? `; lo más corto fue la etapa ${peor.n} (${nomEtapa[peor.n]}): ${pct(peor.real / peor.guia)}% de la guía` : ''}.`,
          accion: lenta
            ? `Poco alimento y ganancia baja: en el próximo ciclo sube la ración${peor ? `, sobre todo en ${nomEtapa[peor.n]}` : ''}, hasta acercarte a la guía.`
            : 'La ganancia fue buena con menos alimento que la guía: puedes mantener la ración y vigilar el peso.'
        });
      } else if (mucha) {
        const mal = ci.fcr > 3.4;
        h.push({
          tono: mal ? 'warn' : 'info',
          texto: `Diste ${pct(ci.ratio)}% de la guía de alimento (${f(ci.kgCerdo)} kg por cerdo contra ${f(ci.guiaCerdo)} kg sugeridos).`,
          accion: mal ? 'Se comió mucho para lo que subió de peso: baja un poco la ración y revisa desperdicio en comederos y parásitos.' : ''
        });
      } else {
        h.push({ tono: 'ok', texto: `La ración estuvo dentro de la guía (${pct(ci.ratio)}%).` });
      }
    } else if (ci.c.dias > 0) {
      h.push({ tono: 'info', texto: 'No hay alimento registrado: configura la ración diaria para poder comparar contra la guía.' });
    }

    // 2) Ganancia diaria de peso
    if (ci.gdp > 0) {
      if (ci.gdp >= 700) h.push({ tono: 'ok', texto: `Ganancia diaria excelente: ${f(ci.gdp, 0)} g/día.` });
      else if (ci.gdp >= 550) h.push({ tono: 'info', texto: `Ganancia diaria normal: ${f(ci.gdp, 0)} g/día.` });
      else h.push({ tono: 'warn', texto: `Ganancia diaria baja: ${f(ci.gdp, 0)} g/día (lo ideal es 550 g o más en el ciclo completo).`, accion: 'Revisa cantidad y calidad del alimento, agua limpia, desparasitación y espacio por animal.' });
    } else if (ci.pesoVivo > 0 && !(ci.l.pesoInicial > 0)) {
      h.push({ tono: 'info', texto: 'Falta el peso inicial para calcular la ganancia diaria. Edita el registro y anótalo.' });
    }

    // 3) Conversión
    if (ci.fcr > 0) {
      if (ci.fcr <= 2.9) h.push({ tono: 'ok', texto: `Conversión excelente: ${f(ci.fcr, 2)} kg de alimento por kg ganado.` });
      else if (ci.fcr <= 3.4) h.push({ tono: 'info', texto: `Conversión aceptable: ${f(ci.fcr, 2)} kg por kg ganado.` });
      else h.push({ tono: 'warn', texto: `Conversión alta: ${f(ci.fcr, 2)} kg de alimento por kg ganado.`, accion: 'Cuida desperdicio, calidad del alimento y salud (parásitos).' });
    }

    // 4) Calidad de la carne (canal)
    if (ci.rend > 0) {
      const txt = ci.canalReal ? '' : ' (estimado: registra el peso real sin tripas)';
      if (ci.rend >= 75) h.push({ tono: 'ok', texto: `Rendimiento en canal excelente: ${f(ci.rend)}%${txt}.` });
      else if (ci.rend >= 71) h.push({ tono: 'info', texto: `Rendimiento en canal normal: ${f(ci.rend)}%${txt}.` });
      else h.push({ tono: 'warn', texto: `Rendimiento en canal bajo: ${f(ci.rend)}%${txt}.`, accion: 'Ayuna al animal antes de beneficiar y revisa la dieta de finalización (menos fibra y grasa).' });
    }

    // 5) Mortalidad
    if (ci.l.cantidadInicial > 1) {
      if (ci.mort >= 5) h.push({ tono: 'crit', texto: `Mortalidad alta: ${f(ci.mort)}% (${ci.c.muertos} de ${ci.l.cantidadInicial}).`, accion: 'Revisa vacunas, higiene, temperatura y el manejo de los primeros 45 días.' });
      else if (ci.c.muertos > 0) h.push({ tono: 'info', texto: `Mortalidad: ${f(ci.mort)}% (${ci.c.muertos} de ${ci.l.cantidadInicial}).` });
      else h.push({ tono: 'ok', texto: 'Sin muertes en este ciclo.' });
    }

    // 6) Duración del ciclo terminado
    if (ci.c.estado === 'finalizado') {
      if (ci.dias > 180) h.push({ tono: 'warn', texto: `Ciclo largo: ${ci.dias} días (lo normal es 150 a 180).`, accion: 'Un ciclo más largo gasta más alimento: revisa si faltó ración o ganancia.' });
      else if (ci.dias < 150) h.push({ tono: 'info', texto: `Ciclo corto: ${ci.dias} días.` });
    }

    // 7) Contra el ciclo anterior
    if (prev && prev.suficiente) {
      const cmp = (nombre, a, b, mejorSiBaja, fmt) => {
        if (!(a > 0 && b > 0)) return;
        const d = (a - b) / b;
        if (Math.abs(d) < 0.05) return;
        const mejor = mejorSiBaja ? d < 0 : d > 0;
        h.push({ tono: mejor ? 'ok' : 'warn', texto: `${nombre}: ${fmt(a)} contra ${fmt(b)} en «${prev.l.nombre}» (${d > 0 ? '+' : ''}${Math.round(d * 100)}%).` });
      };
      if (ci.c.estado === 'finalizado' && prev.c.estado === 'finalizado') cmp('Costo por kg vivo', ci.costoKg, prev.costoKg, true, usd);
      cmp('Ganancia diaria', ci.gdp, prev.gdp, false, v => dec(v, 0) + ' g');
      cmp('Conversión', ci.fcr, prev.fcr, true, v => dec(v, 2));
      cmp('Rendimiento en canal', ci.rend, prev.rend, false, v => dec(v, 1) + '%');
    }
    return h;
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
