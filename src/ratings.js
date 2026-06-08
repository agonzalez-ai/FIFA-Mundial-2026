// ratings.js — FASE 2: fuerza por seleccion ajustando Dixon-Coles a los RESULTADOS
// de las eliminatorias (data/out/quali_results.csv), con ranking FIFA como ancla de
// comparabilidad entre confederaciones.
//
// Salidas:
//   data/out/ratings.csv   -> team_id, team, confederacion, ataque, defensa, net,
//                             n_partidos, fifa_points, fuente, fecha_corte
//   data/out/dc_params.json-> { base, h, rho, ... } (parametros globales del ajuste,
//                             que las Fases 3-4 necesitan para derivar el xG)
//
// Integridad:
//  - Solo usa partidos jugados (los filtra Fase 1). No inventa resultados.
//  - Anfitriones (sin eliminatorias) toman su nivel del ancla FIFA -> fuente=ancla_fifa.
//  - Finalista sin partidos NI FIFA -> imputado por percentil bajo, marcado y reportado.

import fs from 'node:fs';
import path from 'node:path';
import { RATINGS, PATHS } from './config.js';
import { aCSV, objetosDesdeDelimitado } from './lib/csv.js';
import { indexarEquipos, casar } from './lib/names.js';
import { ajustar } from './lib/dixoncoles.js';
import { info, warn } from './lib/logger.js';

function cargarCSV(nombre) {
  const ruta = path.join(PATHS.out, nombre);
  if (!fs.existsSync(ruta)) throw new Error(`Falta ${ruta}. Corre primero "npm run extract" (Fase 1).`);
  const { rows } = objetosDesdeDelimitado(fs.readFileSync(ruta, 'utf8'), ',');
  if (rows.length === 0) throw new Error(`${ruta} esta vacio.`);
  return rows;
}

// Percentil nearest-rank (p en 0-100).
export function percentil(valores, p) {
  if (valores.length === 0) return null;
  const o = [...valores].sort((a, b) => a - b);
  return o[Math.min(o.length - 1, Math.floor((p / 100) * (o.length - 1)))];
}

// z-score de un Map<id, valor>. Devuelve Map<id, z> (0 si sd=0).
function zscore(mapa) {
  const vals = [...mapa.values()];
  const mu = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mu) ** 2, 0) / vals.length) || 1;
  return new Map([...mapa].map(([id, v]) => [id, (v - mu) / sd]));
}

// Carga ranking FIFA y lo casa por nombre a team_id usando el indice canonico.
function cargarFifaPorId(idxEquipos) {
  const ruta = path.join(PATHS.raw, `${RATINGS.fifa.cacheFile}.csv`);
  if (!fs.existsSync(ruta)) {
    warn(`Ranking FIFA no provisto (${ruta}). SIN ancla: el nivel relativo entre confederaciones y los anfitriones (sin eliminatorias) no quedaran calibrados. Se recomienda proveerlo.`);
    return { puntos: new Map(), fechaCorte: RATINGS.fifa.fechaCorte };
  }
  const { headers, rows } = objetosDesdeDelimitado(fs.readFileSync(ruta, 'utf8'), ',');
  const cT = headers.find((h) => /team|seleccion|country|pais|name/i.test(h));
  const cP = headers.find((h) => /point|puntos|pts|rating/i.test(h));
  const cD = headers.find((h) => /date|fecha|corte/i.test(h));
  if (!cT || !cP) throw new Error(`fifa_ranking.csv sin columnas equipo/puntos (headers: ${headers.join(',')}).`);
  const puntos = new Map();
  for (const r of rows) {
    const eq = casar(r[cT], idxEquipos);
    const p = Number(r[cP]);
    if (eq && Number.isFinite(p)) puntos.set(eq.team_id, p);
  }
  const fechaCorte = (cD && rows[0]?.[cD]) || RATINGS.fifa.fechaCorte;
  info(`Ranking FIFA: ${puntos.size} equipos casados (corte ${fechaCorte || 'sin fecha'}).`);
  return { puntos, fechaCorte };
}

function main() {
  info('=== FASE 2: fuerza Dixon-Coles desde resultados de eliminatorias ===');
  const quali = cargarCSV(RATINGS.resultsFile);
  const teams = cargarCSV('teams.csv'); // 48 finalistas (team_id global)

  // Partidos -> {homeId, awayId, gh, ga, fecha}
  const crudos = quali.map((r) => ({
    homeId: String(r.home_id), awayId: String(r.away_id),
    gh: Number(r.goles_local), ga: Number(r.goles_visita), fecha: r.fecha, conf: r.confederacion,
  })).filter((m) => m.homeId && m.awayId && Number.isFinite(m.gh) && Number.isFinite(m.ga));
  if (crudos.length === 0) throw new Error('quali_results.csv sin partidos validos.');

  // Ponderacion temporal: w = exp(-xi * dias_atras), xi = ln2 / vidaMediaDias.
  const tiempos = crudos.map((m) => new Date(m.fecha).getTime()).filter((t) => Number.isFinite(t));
  const tmax = Math.max(...tiempos);
  const xi = Math.log(2) / RATINGS.dc.vidaMediaDias;
  const matches = crudos.map((m) => {
    const t = new Date(m.fecha).getTime();
    const diasAtras = Number.isFinite(t) ? (tmax - t) / 86400000 : 0;
    return { homeId: m.homeId, awayId: m.awayId, gh: m.gh, ga: m.ga, weight: Math.exp(-xi * diasAtras) };
  });
  const fechaCorte = new Date(tmax).toISOString().slice(0, 10);
  info(`Partidos: ${matches.length} (corte ${fechaCorte}, vida media ${RATINGS.dc.vidaMediaDias}d).`);

  // Indice de nombres para casar el ranking FIFA (finalistas + equipos de eliminatorias).
  const universoNombres = [
    ...teams.map((t) => ({ team_id: String(t.team_id), team: t.team })),
    ...quali.map((r) => ({ team_id: String(r.home_id), team: r.home })),
    ...quali.map((r) => ({ team_id: String(r.away_id), team: r.away })),
  ];
  const idx = indexarEquipos(universoNombres);

  // Ancla FIFA -> z-score por id.
  const { puntos: fifaPuntos, fechaCorte: fifaCorte } = cargarFifaPorId(idx);
  const fifaZ = zscore(fifaPuntos);

  // Confederacion mas frecuente por equipo (de los partidos jugados).
  const confDe = new Map();
  for (const m of crudos) {
    for (const id of [m.homeId, m.awayId]) {
      if (!confDe.has(id)) confDe.set(id, new Map());
      const c = confDe.get(id); c.set(m.conf, (c.get(m.conf) || 0) + 1);
    }
  }
  const confPrincipal = (id) => {
    const c = confDe.get(id); if (!c) return '';
    return [...c.entries()].sort((a, b) => b[1] - a[1])[0][0];
  };

  // Ajuste.
  const fit = ajustar(matches, { fifaZ, ...RATINGS.dc });
  info(`Ajuste DC: base=${fit.base.toFixed(3)}, h=${fit.h.toFixed(3)}, rho=${fit.rho.toFixed(3)}, LL=${fit.ll.toFixed(1)}.`);

  // Filas de salida para los 48 finalistas.
  const netsConDatos = teams
    .map((t) => String(t.team_id))
    .filter((id) => (fit.nMatches.get(id) || 0) > 0)
    .map((id) => fit.ataque.get(id) - fit.defensa.get(id));
  const netImput = percentil(netsConDatos, RATINGS.imputaPercentil);

  const filas = [];
  const imputados = [], soloAncla = [];
  for (const t of teams) {
    const id = String(t.team_id);
    const n = fit.nMatches.get(id) || 0;
    let a = fit.ataque.get(id), d = fit.defensa.get(id), fuente;
    if (n > 0) fuente = 'dixon_coles';
    else if (fifaZ.has(id)) { fuente = 'ancla_fifa'; soloAncla.push(t.team); }
    else { // sin partidos ni FIFA: imputacion documentada
      a = netImput ?? 0; d = 0; fuente = `imputado_p${RATINGS.imputaPercentil}`; imputados.push(t.team);
    }
    filas.push({
      team_id: id, team: t.team, confederacion: confPrincipal(id),
      ataque: a.toFixed(4), defensa: d.toFixed(4), net: (a - d).toFixed(4),
      n_partidos: n, fifa_points: fifaPuntos.has(id) ? fifaPuntos.get(id) : '',
      fuente, fecha_corte: fechaCorte,
    });
  }
  filas.sort((x, y) => Number(y.net) - Number(x.net));

  if (soloAncla.length) warn(`Sin eliminatorias (fuerza del ancla FIFA): ${soloAncla.join(', ')}.`);
  if (imputados.length) warn(`Sin partidos NI FIFA (imputados p${RATINGS.imputaPercentil}): ${imputados.join(', ')}.`);

  fs.mkdirSync(PATHS.out, { recursive: true });
  fs.writeFileSync(path.join(PATHS.out, 'ratings.csv'), aCSV(filas, [
    'team_id', 'team', 'confederacion', 'ataque', 'defensa', 'net', 'n_partidos', 'fifa_points', 'fuente', 'fecha_corte',
  ]));
  info(`Escrito ${path.join(PATHS.out, 'ratings.csv')} (${filas.length} finalistas).`);

  // Parametros globales para Fases 3-4.
  const dcParams = {
    base: fit.base, h: fit.h, rho: fit.rho,
    vidaMediaDias: RATINGS.dc.vidaMediaDias, eta: RATINGS.dc.eta, sigma: RATINGS.dc.sigma,
    n_matches: matches.length, fecha_corte: fechaCorte, fifa_corte: fifaCorte, ll: fit.ll,
  };
  fs.writeFileSync(path.join(PATHS.out, 'dc_params.json'), JSON.stringify(dcParams, null, 2) + '\n');
  info(`Escrito ${path.join(PATHS.out, 'dc_params.json')}.`);
  info('=== FASE 2 completa ===');
}

const invocadoDirecto = import.meta.url === `file://${process.argv[1]}`;
if (invocadoDirecto) {
  try { main(); }
  catch (e) { console.error(`\nRATINGS ABORTADO: ${e.message}\n`); process.exit(1); }
}
