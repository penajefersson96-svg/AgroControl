/* =====================================================================
   share.js — resumen ejecutivo para WhatsApp con firma y enlace automático
   ===================================================================== */
'use strict';

const Share = {
  texto(l) {
    const c = Calc.lote(l), ind = l.tipo === 'individual';
    const enBs = v => (c.tasa ? ` (≈ ${bs(v * c.tasa)})` : '');
    const t = [];

    t.push(`🐖 *AGROCONTROL CERDOS — REPORTE*`);
    t.push(`📌 *${l.nombre.toUpperCase()}*`);
    t.push(`━━━━━━━━━━━━━━━━━━━━`);
    t.push(ind ? `• *Tipo:* Cerdo individual` : `• *Lote:* ${c.vivos} vivos de ${l.cantidadInicial} iniciales${(c.muertos + c.vendidos) ? ` (${c.muertos} muertos · ${c.vendidos} vendidos)` : ''}`);
    t.push(`• *Inicio:* ${fecha(l.fechaInicio)}${l.fechaFin ? ` | *Fin:* ${fecha(l.fechaFin)}` : ''}`);
    t.push(`• *Tiempo:* Día ${c.dias} (${c.semanas} sem / ${c.meses} meses)`);
    t.push(`• *Etapa actual:* ${c.etapaActual.nombre}`);
    t.push('');

    t.push(`💰 *RESUMEN FINANCIERO*`);
    t.push(`• *Inversión acumulada:* ${usd(c.total)}${enBs(c.total)}`);
    t.push(`  ├ Compra animales: ${usd(c.compra)}`);
    t.push(`  ├ Alimento (${dec(c.kgAlimento, 1)} kg / ${dec(c.kgAlimento / 40, 1)} sacos): ${usd(c.alimento)}`);
    t.push(`  └ Veterinario y otros: ${usd(c.vet + c.varios)}`);
    if (!ind) t.push(`• *Costo por cerdo vivo:* ${usd(c.porAnimal)}${enBs(c.porAnimal)}`);
    t.push('');

    t.push(`⚖️ *PESO Y PRECIO MÍNIMO (EN PIE)*`);
    if (c.peso > 0) {
      t.push(`• *Peso ${ind ? 'actual' : 'promedio'} vivo:* ${dec(c.peso, 1)} kg${ind ? '' : ` (${dec(c.kilos, 1)} kg totales)`}`);
      t.push(`• *Costo real por kg vivo:* *${usd(c.costoKg)}*${enBs(c.costoKg)}`);
      if (c.fcr > 0) t.push(`• *Conversión:* ${dec(c.fcr, 2)} kg alimento por kg de carne`);
    } else {
      t.push(`• Peso aún sin registrar`);
    }

    // Si ya tiene control de calidad (Beneficio / Canal sin tripas) o peso registrado
    if (c.peso > 0) {
      t.push('');
      t.push(`🥩 *RENDIMIENTO EN CANAL (SIN TRIPAS)*`);
      t.push(`• *Peso en canal (${c.tieneCanalReal ? 'Real' : 'Est. 75%'}):* ${dec(c.pesoCanal, 1)} kg/cerdo${ind ? '' : ` (${dec(c.kilosCanal, 1)} kg totales)`}`);
      t.push(`• *Merma de vísceras:* -${dec(c.mermaTripasKg, 1)} kg (${dec(c.rendimientoCanal, 1)}% aprovechamiento)`);
      t.push(`• *Costo real por kg sin tripas:* *${usd(c.costoKgCanal)}*${enBs(c.costoKgCanal)}`);
    }

    if (l.notasCalidad) {
      t.push('');
      t.push(`📝 *Observaciones de la cría:*`);
      t.push(`"${l.notasCalidad}"`);
    }

    const url = location.protocol.startsWith('http') ? `\n📲 ${location.origin}${location.pathname}` : '';
    t.push(`━━━━━━━━━━━━━━━━━━━━`);
    t.push(`📊 *Generado con AgroControl Cerdos*${url}`);
    return t.join('\n');
  },

  async copiar(texto) {
    try { await navigator.clipboard.writeText(texto); Utils.toast('Reporte copiado'); }
    catch (e) {
      const ta = document.getElementById('share-text');
      if (ta) { ta.select(); document.execCommand('copy'); Utils.toast('Reporte copiado'); }
    }
  },

  whatsapp: texto => window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank')
};
