// simulate.js — FASE 4: simulacion Monte Carlo de la fase de grupos.
//
// Lee SOLO de disco (data/out CSVs de fases previas): cero llamadas a la API.
// En cada iteracion simula los 72 partidos (Poisson por equipo), arma las 12
// tablas, aplica los desempates OFICIALES FIFA 2026 (lib/standings.js) y rankea
// los 8 mejores terceros. Con N>=50,000 iteraciones y RNG sembrado (reproducible).
//
// Salidas:
//   data/out/match_probs.csv  (analitico exacto, desde la matriz de Poisson)
//   data/out/group_probs.csv  (P(1o),P(2o),P(top2),P(mejor 3o),P(avanza),P(elim))
//   data/out/reporte.md       (tablas por grupo + supuestos + fuentes + cortes)

import fs from 'node:fs';
import path from 'node:path';
import { SIM, TORNEO, PATHS, RATINGS } from './config.js';
import { aCSV, objetosDesdeDelimitado } from './lib/csv.js';
import { crearRng, muestrearPoisson } from './lib/rng.js';
import { cargarFit, lambdasFixture, matrizMarcadores, resumenPartido } from './model.js';
import { ordenarGrupo, rankearTerceros } from './lib/standings.js';
import { info, warn } from './lib/logger.js';

function cargarCSV(nombre) {
  const ruta = path.join(PATHS.out, nombre);
  if (!fs.existsSync(ruta)) throw new Error(`Falta ${ruta}. Corre las fases previas (extract, ratings).`);
  return objetosDesdeDelimitado(fs.readFileSync(ruta, 'utf8'), ',').rows;
}

// Prepara la estructura del torneo a partir de los CSV + el ajuste (fit) de Fase 2.
// Funcion (semi)pura: no I/O. Las lambdas se PRECOMPUTAN (deterministas por fuerza+localia).
export function prepararTorneo(ratings, fixtures, teams, groups, fit) {
  const fifaPorId = new Map(ratings.map((r) => [String(r.team_id), Number(r.fifa_points)]));
  const nombrePorId = new Map(teams.map((t) => [String(t.team_id), t.team]));
  const infoEquipos = new Map(teams.map((t) => [String(t.team_id), { team: t.team, country: t.country }]));

  // Grupos: grupo -> [team_id...]
  const gruposMap = new Map();
  for (const g of groups) {
    if (!g.group || !g.team_id) continue;
    if (!gruposMap.has(g.group)) gruposMap.set(g.group, []);
    gruposMap.get(g.group).push(String(g.team_id));
  }
  if (gruposMap.size === 0) {
    throw new Error('groups.csv sin grupos (standings vacio en Fase 1). No se puede simular.');
  }

  const porGrupo = new Map();
  const matchMeta = []; // para match_probs.csv
  for (const f of fixtures) {
    if (!f.group || !/^[A-L]$/.test(f.group)) continue;
    const hId = String(f.home_id), aId = String(f.away_id);
    if (!fit.ataque.has(hId) || !fit.ataque.has(aId)) {
      throw new Error(`Sin fuerza para fixture ${f.fixture_id} (${f.home}/${f.away}). Revisa ratings.csv (Fase 2).`);
    }
    const { lambdaLocal, lambdaVisita, signo } = lambdasFixture(fit, f, infoEquipos);
    if (!porGrupo.has(f.group)) porGrupo.set(f.group, []);
    porGrupo.get(f.group).push({ homeId: hId, awayId: aId, lambdaLocal, lambdaVisita });
    matchMeta.push({ f, signo, lambdaLocal, lambdaVisita });
  }
  return { gruposMap, porGrupo, fifaPorId, nombrePorId, matchMeta };
}

// Una iteracion: simula y devuelve, por equipo, su posicion (1..4) y stats del 3o.
function simularIteracion(gruposMap, porGrupo, fifaPorId, rng, ctx) {
  const posiciones = new Map(); // id -> 1..4
  const terceros = [];
  for (const [grupo, ids] of gruposMap) {
    const fixturesG = porGrupo.get(grupo) || [];
    const partidos = fixturesG.map((m) => ({
      homeId: m.homeId, awayId: m.awayId,
      gh: muestrearPoisson(m.lambdaLocal, rng),
      ga: muestrearPoisson(m.lambdaVisita, rng),
    }));
    const { orden, overall } = ordenarGrupo(ids, partidos, fifaPorId, rng, ctx);
    orden.forEach((id, i) => posiciones.set(id, i + 1));
    const tercero = orden[2];
    const o = overall.get(tercero);
    terceros.push({ id: tercero, pts: o.pts, gd: o.gd, gf: o.gf });
  }
  // 8 mejores terceros
  const ordenTerceros = rankearTerceros(terceros, fifaPorId, rng, ctx);
  const mejoresTerceros = new Set(ordenTerceros.slice(0, TORNEO.mejoresTerceros));
  return { posiciones, mejoresTerceros };
}

function main() {
  const t0 = Date.now();
  info(`=== FASE 4: Monte Carlo (N=${SIM.iteraciones}, semilla=${SIM.semilla}) ===`);
  const fit = cargarFit();
  const ratings = cargarCSV('ratings.csv');
  const fixtures = cargarCSV('fixtures.csv');
  const teams = cargarCSV('teams.csv');
  const groups = cargarCSV('groups.csv');

  const { gruposMap, porGrupo, fifaPorId, nombrePorId, matchMeta } = prepararTorneo(ratings, fixtures, teams, groups, fit);
  const nPartidos = matchMeta.length;
  if (nPartidos !== TORNEO.partidosFaseGrupos) {
    warn(`Partidos de fase de grupos: ${nPartidos} (esperados ${TORNEO.partidosFaseGrupos}). Se simula lo disponible.`);
  }

  // --- match_probs.csv (analitico exacto) ---
  const filasMatch = matchMeta.map(({ f, signo, lambdaLocal, lambdaVisita }) => {
    const r = resumenPartido(matrizMarcadores(lambdaLocal, lambdaVisita, SIM.maxGoles));
    return {
      fixture_id: f.fixture_id, group: f.group, home: f.home, away: f.away,
      localia: signo, xg_home: lambdaLocal.toFixed(3), xg_away: lambdaVisita.toFixed(3),
      p_local: r.pLocal.toFixed(4), p_empate: r.pEmpate.toFixed(4), p_visita: r.pVisita.toFixed(4),
      marcador_prob: r.marcadorProb,
    };
  });
  escribir('match_probs.csv', filasMatch, [
    'fixture_id', 'group', 'home', 'away', 'localia', 'xg_home', 'xg_away',
    'p_local', 'p_empate', 'p_visita', 'marcador_prob',
  ]);

  // --- Monte Carlo ---
  const N = SIM.iteraciones;
  const rng = crearRng(SIM.semilla);
  const ctx = { empatesAzar: 0 };
  const cont = new Map(); // id -> {c1,c2,c3,c4,top2,tercero,avanza}
  for (const ids of gruposMap.values()) for (const id of ids) cont.set(id, { c1: 0, c2: 0, c3: 0, c4: 0, top2: 0, tercero: 0, avanza: 0 });

  for (let it = 0; it < N; it++) {
    const { posiciones, mejoresTerceros } = simularIteracion(gruposMap, porGrupo, fifaPorId, rng, ctx);
    for (const [id, pos] of posiciones) {
      const c = cont.get(id);
      if (pos === 1) { c.c1++; c.top2++; c.avanza++; }
      else if (pos === 2) { c.c2++; c.top2++; c.avanza++; }
      else if (pos === 3) { c.c3++; if (mejoresTerceros.has(id)) { c.tercero++; c.avanza++; } }
      else c.c4++;
    }
  }

  // --- group_probs.csv ---
  const grupoDe = new Map();
  for (const [g, ids] of gruposMap) for (const id of ids) grupoDe.set(id, g);
  const filasGrupo = [];
  for (const [id, c] of cont) {
    filasGrupo.push({
      group: grupoDe.get(id), team_id: id, team: nombrePorId.get(id) || id,
      p_1: (c.c1 / N).toFixed(4), p_2: (c.c2 / N).toFixed(4),
      p_top2: (c.top2 / N).toFixed(4), p_mejor_tercero: (c.tercero / N).toFixed(4),
      p_avanza: (c.avanza / N).toFixed(4), p_eliminado: ((N - c.avanza) / N).toFixed(4),
    });
  }
  filasGrupo.sort((a, b) => a.group.localeCompare(b.group) || Number(b.p_avanza) - Number(a.p_avanza));
  escribir('group_probs.csv', filasGrupo, [
    'group', 'team_id', 'team', 'p_1', 'p_2', 'p_top2', 'p_mejor_tercero', 'p_avanza', 'p_eliminado',
  ]);

  // --- reporte.md ---
  escribirReporte(filasGrupo, { N, nPartidos, ctx, fit, fechaCorte: ratings[0]?.fecha_corte });

  const segs = ((Date.now() - t0) / 1000).toFixed(1);
  if (ctx.empatesAzar) warn(`Empates resueltos por azar (ultimo recurso): ${ctx.empatesAzar} en ${N} iteraciones (${(ctx.empatesAzar / N).toFixed(6)} por corrida).`);
  info(`=== FASE 4 completa en ${segs}s ===`);
}

function escribir(nombre, filas, columnas) {
  fs.mkdirSync(PATHS.out, { recursive: true });
  const ruta = path.join(PATHS.out, nombre);
  fs.writeFileSync(ruta, aCSV(filas, columnas));
  info(`Escrito ${ruta} (${filas.length} filas).`);
}

function escribirReporte(filasGrupo, meta) {
  const { N, nPartidos, ctx, fit, fechaCorte } = meta;
  const L = [];
  L.push('# Reporte — Pronóstico fase de grupos, Mundial FIFA 2026');
  L.push('');
  L.push(`_Generado: ${new Date().toISOString()}_`);
  L.push('');
  L.push('## Supuestos y parámetros del modelo');
  L.push('');
  L.push(`- **Iteraciones Monte Carlo:** ${N.toLocaleString('en-US')} (RNG sembrado: ${SIM.semilla}, reproducible).`);
  L.push(`- **Partidos de fase de grupos simulados:** ${nPartidos} / ${TORNEO.partidosFaseGrupos}.`);
  L.push('- **Fuerza:** modelo Poisson Dixon-Coles ajustado a los resultados de las eliminatorias (Fase 2).');
  L.push('- **Modelo de gol:** Poisson independiente por equipo: log λ_local = base + localía·h + ataque_local + defensa_visita; log λ_visita = base + ataque_visita + defensa_local.');
  L.push(`- **Parámetros ajustados:** base=${fit.base.toFixed(3)}, h (ventaja de local)=${fit.h.toFixed(3)}, ρ (Dixon-Coles)=${fit.rho.toFixed(3)}.`);
  L.push('- **Ventaja de localía:** se aplica h solo al anfitrión (USA/México/Canadá) jugando en su país (mapa sede→país); 0 en sede neutral.');
  L.push('');
  L.push('## Desempates aplicados (orden oficial FIFA 2026, verificado)');
  L.push('');
  L.push('1. Puntos head-to-head (entre empatados) · 2. Dif. goles h2h · 3. Goles h2h');
  L.push('4. Dif. goles global · 5. Goles global · 6. _Fair-play (OMITIDO: sin datos de tarjetas)_ · 7. Ranking FIFA · 8. Sorteo→azar sembrado.');
  L.push(`- **Empates resueltos por azar (último recurso):** ${ctx.empatesAzar} en ${N} iteraciones.`);
  L.push('- _Nota de integridad:_ el criterio de fair-play no se modela porque no se simulan tarjetas (no se inventan datos disciplinarios).');
  L.push('');
  L.push('## Fuentes y fechas de corte');
  L.push('');
  L.push('- **Resultados de eliminatorias / fixtures / grupos / equipos:** API-Football v3. Crudo versionado en `data/raw/`.');
  L.push(`- **Fuerza (ataque/defensa):** ajuste Dixon-Coles sobre resultados de eliminatorias. Fecha de corte: ${fechaCorte || 'ver ratings.csv'}.`);
  L.push(`- **Ranking FIFA (ancla de comparabilidad + desempate):** ${RATINGS.fifa.fuente}. Corte: ${RATINGS.fifa.fechaCorte || 'ver fifa_ranking.csv'}.`);
  L.push('');
  L.push('## Probabilidades de avance por grupo');
  L.push('');
  L.push('P = probabilidad estimada (frecuencia en la simulación). "Avanza" = top-2 del grupo o mejor tercero.');
  L.push('');
  const grupos = [...new Set(filasGrupo.map((r) => r.group))].sort();
  for (const g of grupos) {
    L.push(`### Grupo ${g}`);
    L.push('');
    L.push('| Equipo | P(1º) | P(2º) | P(top-2) | P(mejor 3º) | **P(avanza)** | P(elim.) |');
    L.push('|---|---:|---:|---:|---:|---:|---:|');
    for (const r of filasGrupo.filter((x) => x.group === g)) {
      const pct = (v) => `${(Number(v) * 100).toFixed(1)}%`;
      L.push(`| ${r.team} | ${pct(r.p_1)} | ${pct(r.p_2)} | ${pct(r.p_top2)} | ${pct(r.p_mejor_tercero)} | **${pct(r.p_avanza)}** | ${pct(r.p_eliminado)} |`);
    }
    L.push('');
  }
  fs.writeFileSync(path.join(PATHS.out, 'reporte.md'), L.join('\n') + '\n');
  info(`Escrito ${path.join(PATHS.out, 'reporte.md')}.`);
}

const invocadoDirecto = import.meta.url === `file://${process.argv[1]}`;
if (invocadoDirecto) {
  try { main(); }
  catch (e) { console.error(`\nSIMULACION ABORTADA: ${e.message}\n`); process.exit(1); }
}
