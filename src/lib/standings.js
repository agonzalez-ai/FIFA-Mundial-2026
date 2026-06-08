// standings.js — Tablas de grupo y desempates OFICIALES FIFA 2026 (PUROS).
//
// Orden VERIFICADO en runtime (ver README, "Desempates"):
//   Dentro del grupo, equipos igualados en PUNTOS:
//     1) puntos head-to-head (solo partidos entre los empatados)
//     2) diferencia de goles head-to-head
//     3) goles a favor head-to-head
//     4) diferencia de goles global
//     5) goles a favor global
//     6) fair-play / conducta  <-- NO modelado (sin datos de tarjetas); se OMITE
//                                  y se documenta. No se inventan tarjetas.
//     7) ranking FIFA (puntos)
//     8) (ultimo recurso) sorteo -> azar sembrado, contabilizado y reportado.
//   Ranking de TERCEROS (entre grupos, sin head-to-head):
//     puntos -> dif. goles -> goles a favor -> [fair-play omitido] -> ranking FIFA -> azar.
//
// partidos: [{ homeId, awayId, gh, ga }] con marcadores ya simulados.

// Acumula estadisticas (pts, gd, gf) contando solo partidos entre equipos del set.
export function statsDe(partidos, idsSet) {
  const s = new Map();
  for (const id of idsSet) s.set(id, { id, pts: 0, gd: 0, gf: 0, ga: 0 });
  for (const m of partidos) {
    if (!idsSet.has(m.homeId) || !idsSet.has(m.awayId)) continue;
    const h = s.get(m.homeId), a = s.get(m.awayId);
    h.gf += m.gh; h.ga += m.ga; h.gd += m.gh - m.ga;
    a.gf += m.ga; a.ga += m.gh; a.gd += m.ga - m.gh;
    if (m.gh > m.ga) h.pts += 3;
    else if (m.gh < m.ga) a.pts += 3;
    else { h.pts += 1; a.pts += 1; }
  }
  return s;
}

// Particiona una lista YA ORDENADA en clases consecutivas iguales segun keyFn.
function clasesIguales(ordenados, keyFn) {
  const clases = [];
  for (const x of ordenados) {
    const k = keyFn(x);
    const ult = clases[clases.length - 1];
    if (ult && ult.k === k) ult.items.push(x);
    else clases.push({ k, items: [x] });
  }
  return clases.map((c) => c.items);
}

// Baraja in-place con RNG sembrado (Fisher-Yates). Devuelve el array.
function barajar(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Resuelve por criterios GLOBALES (4,5,7) + azar, para un conjunto ya empatado en h2h.
function resolverGlobal(ids, overall, fifaPts, rng, ctx) {
  const orden = [...ids].sort((x, y) => {
    const ox = overall.get(x), oy = overall.get(y);
    if (oy.gd !== ox.gd) return oy.gd - ox.gd;          // 4) dif goles global
    if (oy.gf !== ox.gf) return oy.gf - ox.gf;          // 5) goles global
    const fx = fifaPts.get(x) ?? -Infinity, fy = fifaPts.get(y) ?? -Infinity;
    if (fy !== fx) return fy - fx;                       // 7) ranking FIFA
    return 0;
  });
  // Clases aun exactamente iguales (gd, gf, fifa) -> azar (ultimo recurso).
  const clases = clasesIguales(orden, (id) => {
    const o = overall.get(id);
    return `${o.gd}|${o.gf}|${fifaPts.get(id) ?? ''}`;
  });
  const out = [];
  for (const c of clases) {
    if (c.length === 1) out.push(c[0]);
    else { if (ctx) ctx.empatesAzar += 1; out.push(...barajar([...c], rng)); }
  }
  return out;
}

// Resuelve un conjunto empatado en PUNTOS aplicando head-to-head (1,2,3) y, si no
// separa, criterios globales. Recursivo: re-aplica h2h solo entre los aun empatados.
function resolverEmpate(ids, partidos, overall, fifaPts, rng, ctx) {
  if (ids.length === 1) return ids;
  const h2h = statsDe(partidos, new Set(ids));
  const orden = [...ids].sort((x, y) => {
    const hx = h2h.get(x), hy = h2h.get(y);
    if (hy.pts !== hx.pts) return hy.pts - hx.pts;      // 1) pts h2h
    if (hy.gd !== hx.gd) return hy.gd - hx.gd;          // 2) dif goles h2h
    if (hy.gf !== hx.gf) return hy.gf - hx.gf;          // 3) goles h2h
    return 0;
  });
  const clases = clasesIguales(orden, (id) => {
    const h = h2h.get(id);
    return `${h.pts}|${h.gd}|${h.gf}`;
  });
  if (clases.length === 1) {
    // h2h no separo a nadie -> criterios globales (4,5,[6 omitido],7,azar)
    return resolverGlobal(ids, overall, fifaPts, rng, ctx);
  }
  const out = [];
  for (const c of clases) {
    if (c.length === 1) out.push(c[0]);
    else out.push(...resolverEmpate(c, partidos, overall, fifaPts, rng, ctx)); // re-aplica h2h entre los restantes
  }
  return out;
}

// Ordena un grupo (4 equipos) de 1o a 4o segun puntos y desempates FIFA 2026.
// Devuelve array de ids ordenado. ctx (opcional) acumula uso de azar.
export function ordenarGrupo(ids, partidos, fifaPts, rng, ctx) {
  const overall = statsDe(partidos, new Set(ids));
  // 1er criterio: puntos globales.
  const porPuntos = [...ids].sort((x, y) => overall.get(y).pts - overall.get(x).pts);
  const clases = clasesIguales(porPuntos, (id) => String(overall.get(id).pts));
  const out = [];
  for (const c of clases) {
    if (c.length === 1) out.push(c[0]);
    else out.push(...resolverEmpate(c, partidos, overall, fifaPts, rng, ctx));
  }
  return { orden: out, overall };
}

// Rankea los terceros de todos los grupos (sin head-to-head). Devuelve ids ordenados.
// terceros: [{ id, pts, gd, gf }]. Empata por ranking FIFA y, por ultimo, azar.
export function rankearTerceros(terceros, fifaPts, rng, ctx) {
  const orden = [...terceros].sort((x, y) => {
    if (y.pts !== x.pts) return y.pts - x.pts;
    if (y.gd !== x.gd) return y.gd - x.gd;
    if (y.gf !== x.gf) return y.gf - x.gf;
    const fx = fifaPts.get(x.id) ?? -Infinity, fy = fifaPts.get(y.id) ?? -Infinity;
    if (fy !== fx) return fy - fx;
    return 0;
  });
  const clases = clasesIguales(orden, (t) => `${t.pts}|${t.gd}|${t.gf}|${fifaPts.get(t.id) ?? ''}`);
  const out = [];
  for (const c of clases) {
    if (c.length === 1) out.push(c[0].id);
    else { if (ctx) ctx.empatesAzar += 1; out.push(...barajar([...c], rng).map((t) => t.id)); }
  }
  return out;
}
