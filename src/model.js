// model.js — FASE 3: modelo de partido transparente (fuerza Dixon-Coles -> Poisson).
//
// El xG de cada partido sale del ajuste de la Fase 2 (ataque/defensa por equipo +
// base + ventaja de local h), NO de un Elo externo:
//   log λ_local  = base + signo·h + ataque_local + defensa_visita
//   log λ_visita = base          + ataque_visita + defensa_local
// donde signo ∈ {+1 (anfitrion en casa), 0 (neutral), -1 (anfitrion de visita)}
// segun el mapa sede->pais (lib/venues.js). En el Mundial casi todo es neutral.
//
// Marcador ~ Poisson(λ_local) x Poisson(λ_visita) (independientes). De la matriz
// salen P(local), P(empate), P(visita) y el marcador mas probable -> match_probs.csv
// de forma ANALITICA EXACTA. Funciones de calculo PURAS y testeables.

import fs from 'node:fs';
import path from 'node:path';
import { TORNEO, PATHS, SIM } from './config.js';
import { aCSV, objetosDesdeDelimitado } from './lib/csv.js';
import { signoLocalia } from './lib/venues.js';
import { lambdasDC } from './lib/dixoncoles.js';
import { crearRng, muestrearPoisson } from './lib/rng.js';
import { info, warn } from './lib/logger.js';

// --- Nucleo matematico (puro) ----------------------------------------------

// pmf de Poisson: P(X=k) con media lambda.
export function poissonPmf(k, lambda) {
  let fact = 1;
  for (let i = 2; i <= k; i++) fact *= i;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / fact;
}

// Matriz de marcadores P(i,j)=P(local=i)·P(visita=j), i,j en 0..maxGoles, renormalizada.
export function matrizMarcadores(lambdaLocal, lambdaVisita, maxGoles = 10) {
  const pl = Array.from({ length: maxGoles + 1 }, (_, i) => poissonPmf(i, lambdaLocal));
  const pv = Array.from({ length: maxGoles + 1 }, (_, j) => poissonPmf(j, lambdaVisita));
  const M = [];
  let total = 0;
  for (let i = 0; i <= maxGoles; i++) {
    M[i] = [];
    for (let j = 0; j <= maxGoles; j++) { const p = pl[i] * pv[j]; M[i][j] = p; total += p; }
  }
  for (let i = 0; i <= maxGoles; i++) for (let j = 0; j <= maxGoles; j++) M[i][j] /= total;
  return M;
}

// Resume una matriz en P(local)/P(empate)/P(visita) y marcador modal.
export function resumenPartido(M) {
  let pLocal = 0, pEmpate = 0, pVisita = 0, mejor = { p: -1, i: 0, j: 0 };
  for (let i = 0; i < M.length; i++) {
    for (let j = 0; j < M[i].length; j++) {
      const p = M[i][j];
      if (i > j) pLocal += p; else if (i === j) pEmpate += p; else pVisita += p;
      if (p > mejor.p) mejor = { p, i, j };
    }
  }
  return { pLocal, pEmpate, pVisita, marcadorProb: `${mejor.i}-${mejor.j}`, pMarcadorProb: mejor.p };
}

// P(total de goles >= umbral) a partir de la matriz (p.ej. umbral=3 => "+2.5 goles").
export function pTotalGE(M, umbral) {
  let p = 0;
  for (let i = 0; i < M.length; i++) for (let j = 0; j < M[i].length; j++) if (i + j >= umbral) p += M[i][j];
  return p;
}

// Marcador SIMULADO: una realizacion del modelo (Poisson por equipo) con el RNG dado.
// Util para generar un escenario completo del torneo (con upsets y goleadas), pero
// NO sirve como prediccion por partido: puede contradecir al favorito.
export function muestrearMarcador(lambdaLocal, lambdaVisita, rng) {
  return `${muestrearPoisson(lambdaLocal, rng)}-${muestrearPoisson(lambdaVisita, rng)}`;
}

// Marcador PREDICHO (consistente): el marcador exacto mas probable CONDICIONADO al
// resultado mas probable (1/X/2). Asi el marcador siempre concuerda con el favorito
// y el margen refleja la diferencia de nivel (favorito claro -> 2-0/3-0; parejo -> 1-0/1-1).
export function marcadorPredicho(M) {
  const { pLocal, pEmpate, pVisita } = resumenPartido(M);
  const rel = (pEmpate >= pLocal && pEmpate >= pVisita) ? 'X' : (pLocal >= pVisita ? '1' : '2');
  let best = { p: -1, i: 0, j: 0 };
  for (let i = 0; i < M.length; i++) {
    for (let j = 0; j < M[i].length; j++) {
      const ok = (rel === '1' && i > j) || (rel === 'X' && i === j) || (rel === '2' && i < j);
      if (ok && M[i][j] > best.p) best = { p: M[i][j], i, j };
    }
  }
  return `${best.i}-${best.j}`;
}

// Marcador de ESCENARIO consistente: muestrea un marcador del modelo PERO condicionado
// a que ocurra el resultado mas probable (1/X/2). Asi el favorito siempre gana (o se
// da el empate cuando es lo mas probable), y el MARGEN varia de forma realista: en
// partidos parejos sale 1-0/2-1, y cuando hay mucha diferencia aparecen 3-0/4-1.
// Es una realizacion (con semilla, reproducible); las sorpresas/goleadas plenas viven
// en las probabilidades, no en esta prediccion puntual.
export function marcadorConsistente(M, lambdaLocal, lambdaVisita, rng, maxIntentos = 500) {
  const { pLocal, pEmpate, pVisita } = resumenPartido(M);
  const rel = (pEmpate >= pLocal && pEmpate >= pVisita) ? 'X' : (pLocal >= pVisita ? '1' : '2');
  for (let t = 0; t < maxIntentos; t++) {
    const h = muestrearPoisson(lambdaLocal, rng), a = muestrearPoisson(lambdaVisita, rng);
    if ((rel === '1' && h > a) || (rel === 'X' && h === a) || (rel === '2' && h < a)) return `${h}-${a}`;
  }
  return marcadorPredicho(M); // respaldo si el muestreo no cae en el resultado (raro)
}

// --- Carga de la fuerza ajustada (Fase 2) ----------------------------------

// Construye el objeto de ajuste {base,h,rho,ataque,defensa} desde ratings.csv +
// dc_params.json (salidas de Fase 2). Es lo que consume lambdasDC / lambdasFixture.
export function cargarFit(dir = PATHS.out) {
  const rRuta = path.join(dir, 'ratings.csv');
  const pRuta = path.join(dir, 'dc_params.json');
  if (!fs.existsSync(rRuta) || !fs.existsSync(pRuta)) {
    throw new Error(`Faltan ${rRuta} y/o ${pRuta}. Corre "npm run ratings" (Fase 2).`);
  }
  const { rows } = objetosDesdeDelimitado(fs.readFileSync(rRuta, 'utf8'), ',');
  const params = JSON.parse(fs.readFileSync(pRuta, 'utf8'));
  const ataque = new Map(), defensa = new Map();
  for (const r of rows) {
    ataque.set(String(r.team_id), Number(r.ataque));
    defensa.set(String(r.team_id), Number(r.defensa));
  }
  return { base: params.base, h: params.h, rho: params.rho, ataque, defensa };
}

// Goles esperados de un fixture del torneo. infoEquipos: Map<id,{team,country}>.
// La ventaja de local se aplica solo a anfitriones en su pais (signo·h).
export function lambdasFixture(fit, fx, infoEquipos) {
  const home = String(fx.home_id), away = String(fx.away_id);
  const iH = infoEquipos.get(home) || {}, iA = infoEquipos.get(away) || {};
  const signo = signoLocalia(iH.team, iH.country, iA.team, iA.country, fx.venue_city, fx.venue_name);
  const { lambdaLocal, lambdaVisita } = lambdasDC(fit, home, away, { hfa: signo * fit.h });
  return { lambdaLocal, lambdaVisita, signo };
}

// --- Orquestacion: genera match_probs.csv (analitico, exacto) ---------------

function cargarCSV(nombre) {
  const ruta = path.join(PATHS.out, nombre);
  if (!fs.existsSync(ruta)) throw new Error(`Falta ${ruta}. Corre las fases previas.`);
  return objetosDesdeDelimitado(fs.readFileSync(ruta, 'utf8'), ',').rows;
}

// Construye el CSV de probabilidades por partido. `rng` (sembrado) genera el
// marcador de escenario consistente (favorito respetado, margen variable).
export function filasMatchProbs(fixturesGrupos, fit, infoEquipos, maxGoles = SIM.maxGoles, rng = null) {
  return fixturesGrupos.map((f) => {
    const { lambdaLocal, lambdaVisita, signo } = lambdasFixture(fit, f, infoEquipos);
    const M = matrizMarcadores(lambdaLocal, lambdaVisita, maxGoles);
    const r = resumenPartido(M);
    return {
      fixture_id: f.fixture_id, group: f.group, home: f.home, away: f.away,
      localia: signo, xg_home: lambdaLocal.toFixed(3), xg_away: lambdaVisita.toFixed(3),
      p_local: r.pLocal.toFixed(4), p_empate: r.pEmpate.toFixed(4), p_visita: r.pVisita.toFixed(4),
      p_mas25: pTotalGE(M, 3).toFixed(4),
      marcador: rng ? marcadorConsistente(M, lambdaLocal, lambdaVisita, rng) : marcadorPredicho(M),
    };
  });
}

function main() {
  info('=== FASE 3: modelo de partido (match_probs.csv analitico) ===');
  const fit = cargarFit();
  const fixtures = cargarCSV('fixtures.csv');
  const teams = cargarCSV('teams.csv');
  const infoEquipos = new Map(teams.map((t) => [String(t.team_id), { team: t.team, country: t.country }]));

  const grupos = fixtures.filter((f) => f.group && /^[A-L]$/.test(f.group));
  if (grupos.length !== TORNEO.partidosFaseGrupos) {
    warn(`Partidos de fase de grupos: ${grupos.length} (esperados ${TORNEO.partidosFaseGrupos}). Se procesa lo disponible.`);
  }
  // Verifica que haya fuerza para cada equipo involucrado.
  for (const f of grupos) {
    if (!fit.ataque.has(String(f.home_id)) || !fit.ataque.has(String(f.away_id))) {
      throw new Error(`Sin fuerza para fixture ${f.fixture_id} (${f.home}/${f.away}). Revisa ratings.csv (Fase 2).`);
    }
  }

  const filas = filasMatchProbs(grupos, fit, infoEquipos, SIM.maxGoles, crearRng(SIM.semilla));
  fs.mkdirSync(PATHS.out, { recursive: true });
  const ruta = path.join(PATHS.out, 'match_probs.csv');
  fs.writeFileSync(ruta, aCSV(filas, [
    'fixture_id', 'group', 'home', 'away', 'localia', 'xg_home', 'xg_away',
    'p_local', 'p_empate', 'p_visita', 'p_mas25', 'marcador',
  ]));
  info(`Escrito ${ruta} (${filas.length} partidos).`);
  info('=== FASE 3 completa ===');
}

const invocadoDirecto = import.meta.url === `file://${process.argv[1]}`;
if (invocadoDirecto) {
  try { main(); }
  catch (e) { console.error(`\nMODELO ABORTADO: ${e.message}\n`); process.exit(1); }
}
