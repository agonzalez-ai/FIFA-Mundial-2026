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
import { cargarFit, lambdasFixture, matrizMarcadores, resumenPartido, pTotalGE, marcadorConsistente } from './model.js';
import { ordenarGrupo, rankearTerceros } from './lib/standings.js';
import { simularKnockout } from './lib/knockout.js';
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

// Una iteracion completa: grupos -> 32 clasificados -> eliminatoria -> campeon/2º/3º.
function simularIteracion(gruposMap, porGrupo, fifaPorId, fit, rng, ctx, trace = false) {
  const posiciones = new Map(); // id -> 1..4
  const terceros = [];
  const W = new Map(), R = new Map();   // ganador y subcampeon por grupo
  const grupoDeTercero = new Map();     // id tercero -> grupo
  for (const [grupo, ids] of gruposMap) {
    const fixturesG = porGrupo.get(grupo) || [];
    const partidos = fixturesG.map((m) => ({
      homeId: m.homeId, awayId: m.awayId,
      gh: muestrearPoisson(m.lambdaLocal, rng),
      ga: muestrearPoisson(m.lambdaVisita, rng),
    }));
    const { orden, overall } = ordenarGrupo(ids, partidos, fifaPorId, rng, ctx);
    orden.forEach((id, i) => posiciones.set(id, i + 1));
    W.set(grupo, orden[0]); R.set(grupo, orden[1]);
    const tercero = orden[2];
    const o = overall.get(tercero);
    terceros.push({ id: tercero, pts: o.pts, gd: o.gd, gf: o.gf });
    grupoDeTercero.set(tercero, grupo);
  }
  // 8 mejores terceros
  const ordenTerceros = rankearTerceros(terceros, fifaPorId, rng, ctx);
  const mejoresTerceros = new Set(ordenTerceros.slice(0, TORNEO.mejoresTerceros));
  // Eliminatoria
  const thirds = ordenTerceros.slice(0, TORNEO.mejoresTerceros).map((id) => ({ id, group: grupoDeTercero.get(id) }));
  const ko = simularKnockout(W, R, thirds, fit, rng, trace);
  return { posiciones, mejoresTerceros, ko };
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

  // --- match_probs.csv (probabilidades exactas + xG + marcador de escenario) ---
  // RNG dedicado (independiente del Monte Carlo) para el marcador consistente.
  const rngSc = crearRng(SIM.semilla ^ 0x5f3759df);
  const filasMatch = matchMeta.map(({ f, signo, lambdaLocal, lambdaVisita }) => {
    const M = matrizMarcadores(lambdaLocal, lambdaVisita, SIM.maxGoles);
    const r = resumenPartido(M);
    return {
      fixture_id: f.fixture_id, group: f.group, home: f.home, away: f.away,
      localia: signo, xg_home: lambdaLocal.toFixed(3), xg_away: lambdaVisita.toFixed(3),
      p_local: r.pLocal.toFixed(4), p_empate: r.pEmpate.toFixed(4), p_visita: r.pVisita.toFixed(4),
      p_mas25: pTotalGE(M, 3).toFixed(4),
      marcador: marcadorConsistente(M, lambdaLocal, lambdaVisita, rngSc),
    };
  });
  escribir('match_probs.csv', filasMatch, [
    'fixture_id', 'group', 'home', 'away', 'localia', 'xg_home', 'xg_away',
    'p_local', 'p_empate', 'p_visita', 'p_mas25', 'marcador',
  ]);

  // --- Monte Carlo ---
  const N = SIM.iteraciones;
  const rng = crearRng(SIM.semilla);
  const ctx = { empatesAzar: 0 };
  const cont = new Map(); // id -> contadores de grupo + eliminatoria
  for (const ids of gruposMap.values()) for (const id of ids) {
    cont.set(id, { c1: 0, c2: 0, c3: 0, c4: 0, top2: 0, tercero: 0, avanza: 0, r16: 0, qf: 0, sf: 0, fin: 0, campeon: 0, sub: 0, terceroT: 0 });
  }

  for (let it = 0; it < N; it++) {
    const { posiciones, mejoresTerceros, ko } = simularIteracion(gruposMap, porGrupo, fifaPorId, fit, rng, ctx);
    for (const [id, pos] of posiciones) {
      const c = cont.get(id);
      if (pos === 1) { c.c1++; c.top2++; c.avanza++; }
      else if (pos === 2) { c.c2++; c.top2++; c.avanza++; }
      else if (pos === 3) { c.c3++; if (mejoresTerceros.has(id)) { c.tercero++; c.avanza++; } }
      else c.c4++;
    }
    // Rondas de eliminatoria alcanzadas (reached = ronda mas profunda).
    for (const [id, ronda] of ko.reached) {
      const c = cont.get(id); if (!c) continue;
      if (ronda <= 16) c.r16++;
      if (ronda <= 8) c.qf++;
      if (ronda <= 4) c.sf++;
      if (ronda <= 2) c.fin++;
    }
    cont.get(ko.champion).campeon++;
    cont.get(ko.runnerUp).sub++;
    cont.get(ko.third).terceroT++;
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

  // --- knockout_probs.csv (probabilidades por ronda + podio) ---
  const filasKO = [];
  for (const [id, c] of cont) filasKO.push({
    team: nombrePorId.get(id) || id, group: grupoDe.get(id),
    p_r16: (c.r16 / N).toFixed(4), p_qf: (c.qf / N).toFixed(4), p_sf: (c.sf / N).toFixed(4),
    p_final: (c.fin / N).toFixed(4), p_campeon: (c.campeon / N).toFixed(4),
    p_subcampeon: (c.sub / N).toFixed(4), p_tercer_lugar: (c.terceroT / N).toFixed(4),
    p_podio: ((c.campeon + c.sub + c.terceroT) / N).toFixed(4),
  });
  filasKO.sort((a, b) => Number(b.p_campeon) - Number(a.p_campeon));
  escribir('knockout_probs.csv', filasKO, [
    'team', 'group', 'p_r16', 'p_qf', 'p_sf', 'p_final', 'p_campeon', 'p_subcampeon', 'p_tercer_lugar', 'p_podio',
  ]);

  // Un torneo representativo (semilla fija) para mostrar marcadores concretos.
  const repr = simularIteracion(gruposMap, porGrupo, fifaPorId, fit, crearRng(SIM.semilla + 1), { empatesAzar: 0 }, true);
  const nom = (id) => nombrePorId.get(id) || id;

  // --- reporte.md ---
  escribirReporte(filasGrupo, { N, nPartidos, ctx, fit, filasMatch, filasKO, repr, nom, fechaCorte: ratings[0]?.fecha_corte });

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
  const { N, nPartidos, ctx, fit, filasMatch, filasKO, repr, nom, fechaCorte } = meta;
  const L = [];
  L.push('# Reporte — Pronóstico Mundial FIFA 2026 (grupos + eliminatoria)');
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

  // ===== Fase de eliminacion: podio + probabilidades =====
  if (filasKO && filasKO.length) {
    const pc = (v) => `${(Number(v) * 100).toFixed(1)}%`;
    const podio = [...filasKO].sort((a, b) => Number(b.p_podio) - Number(a.p_podio)).slice(0, 3);
    L.push('## 🏆 Pronóstico del torneo (fase de eliminación)');
    L.push('');
    L.push('> **Cuadro aproximado:** se usa la estructura publicada del formato 2026 (R32: 8 ganador-vs-3º, '
      + '4 ganador-vs-2º, 4 segundo-vs-2º; sin reencuentros de grupo) con árbol simétrico. **No** es la asignación '
      + 'exacta Annex C de FIFA (495 escenarios para ubicar a los 8 mejores terceros); impacto bajo en P(campeón), '
      + 'moderado en subcampeón/3º. Partidos a sede neutral; empates a penales = 50/50.');
    L.push('');
    L.push(`### 🥇 Campeón más probable: **${filasKO[0].team}** (${pc(filasKO[0].p_campeon)})`);
    L.push('');
    L.push('**Los 3 con mayor probabilidad de subir al podio (top-3):**');
    L.push(`1. ${podio[0].team} — ${pc(podio[0].p_podio)}`);
    L.push(`2. ${podio[1].team} — ${pc(podio[1].p_podio)}`);
    L.push(`3. ${podio[2].team} — ${pc(podio[2].p_podio)}`);
    L.push('');
    L.push('_(El Mundial es muy abierto con 48 equipos: hasta el favorito ronda ~8% de título. '
      + 'Para un 1º-2º-3º concreto y distinto, ver el "torneo representativo" abajo.)_');
    L.push('');
    L.push('### Probabilidades por equipo (top 12 por título)');
    L.push('');
    L.push('| Equipo | Semis | Final | 🏆 Campeón | Podio (top-3) |');
    L.push('|---|--:|--:|--:|--:|');
    for (const r of filasKO.slice(0, 12)) {
      L.push(`| ${r.team} | ${pc(r.p_sf)} | ${pc(r.p_final)} | **${pc(r.p_campeon)}** | ${pc(r.p_podio)} |`);
    }
    L.push('');
    // Torneo representativo
    if (repr && repr.ko && repr.ko.bracket) {
      const b = repr.ko.bracket;
      L.push('### Un torneo representativo (una simulación, marcadores concretos)');
      L.push('');
      L.push('_Una de las formas en que podría desarrollarse (semilla fija). Otra semilla da otro desenlace válido._');
      L.push('');
      const linea = (s) => s.replace(/->/g, '→');
      if (b['Semis']) { L.push('**Semifinales:**'); b['Semis'].forEach((x) => L.push(`- ${linea(x)}`)); L.push(''); }
      if (b['3er lugar']) { L.push(`**3er lugar:** ${linea(b['3er lugar'][0])}`); L.push(''); }
      if (b['Final']) { L.push(`**Final:** ${linea(b['Final'][0])}`); L.push(''); }
      L.push(`Podio de esta simulación: 🥇 ${nom(repr.ko.champion)} · 🥈 ${nom(repr.ko.runnerUp)} · 🥉 ${nom(repr.ko.third)}.`);
      L.push('');
    }
  }

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

  // Pronostico por partido: goles esperados (xG) + probabilidades 1/X/2.
  if (filasMatch && filasMatch.length) {
    L.push('## Pronóstico por partido (goles esperados y marcador)');
    L.push('');
    L.push('`xG` = goles esperados por equipo (la proyección; refleja el potencial de goleada cuando hay mucha diferencia). '
      + '1/X/2 = P(gana local / empate / gana visita). `+2.5` = probabilidad de 3+ goles. '
      + '**`Marcador`** = un marcador plausible muestreado *condicionado a que ocurra el resultado más probable* '
      + '(gana el favorito, o empate si es lo más probable); el margen varía de forma realista (parejo → 1-0/2-1; '
      + 'mucha diferencia → a veces 3-0/4-1). Que gane el no-favorito es una sorpresa que vive en las probabilidades 1/X/2.');
    L.push('');
    const pg = {};
    for (const m of filasMatch) (pg[m.group] ??= []).push(m);
    for (const g of Object.keys(pg).sort()) {
      L.push(`### Grupo ${g}`);
      L.push('');
      L.push('| Partido | xG | 1 | X | 2 | +2.5 | **Marcador** |');
      L.push('|---|:--:|--:|--:|--:|--:|:--:|');
      for (const m of pg[g]) {
        const pct = (v) => `${(Number(v) * 100).toFixed(0)}%`;
        L.push(`| ${m.home} vs ${m.away} | ${m.xg_home}–${m.xg_away} | ${pct(m.p_local)} | ${pct(m.p_empate)} | ${pct(m.p_visita)} | ${pct(m.p_mas25)} | **${m.marcador_pred}** |`);
      }
      L.push('');
    }
  }
  fs.writeFileSync(path.join(PATHS.out, 'reporte.md'), L.join('\n') + '\n');
  info(`Escrito ${path.join(PATHS.out, 'reporte.md')}.`);
}

const invocadoDirecto = import.meta.url === `file://${process.argv[1]}`;
if (invocadoDirecto) {
  try { main(); }
  catch (e) { console.error(`\nSIMULACION ABORTADA: ${e.message}\n`); process.exit(1); }
}
