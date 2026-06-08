// extract.js — FASE 1: extraccion desde API-Football.
//
// Objetivo (corregido): bajar los RESULTADOS de todos los partidos de las
// ELIMINATORIAS del ciclo 2026 (base de datos para estimar la fuerza de cada
// seleccion en la Fase 2), ademas de la estructura del TORNEO FINAL (equipos,
// grupos y fixtures) que dice QUE partidos hay que pronosticar.
//
// Endpoints:
//   leagues?search=world cup           -> resuelve en runtime los league id de las
//                                         eliminatorias por confederacion (no se
//                                         hardcodean de memoria).
//   fixtures?league=<quali>&season=<y> -> partidos de cada eliminatoria (con goles).
//   teams|standings|fixtures league=1  -> torneo final (48 equipos, 12 grupos, 104).
//
// Salidas crudas versionadas en data/raw + tablas limpias en data/out:
//   quali_results.csv, teams.csv, groups.csv, fixtures.csv
//
// Integridad: nunca rellena; loggea cada endpoint; respuestas vacias se anotan;
// si una confederacion no se resuelve, se reporta y se omite (no se inventa).

import fs from 'node:fs';
import path from 'node:path';
import { apiGet, requestsUsados } from './lib/apiClient.js';
import { guardarCrudo, asegurarDir } from './lib/cache.js';
import { aCSV } from './lib/csv.js';
import { info, warn } from './lib/logger.js';
import { API, QUALIFIERS, CICLO_SEASONS, ESTADOS_FINALIZADO, TORNEO, PATHS } from './config.js';

// --- Normalizadores (funciones puras) -------------------------------------

// teams.csv: de /teams (cada item = { team, venue }).
export function normalizarTeams(response) {
  return response.map((it) => ({
    team_id: it.team?.id,
    team: it.team?.name,
    code: it.team?.code || '',
    country: it.team?.country || '',
  }));
}

// groups.csv: de /standings. response[0].league.standings = array de grupos.
export function normalizarGroups(response) {
  const grupos = response[0]?.league?.standings || [];
  const filas = [];
  for (const grupo of grupos) {
    for (const fila of grupo) {
      filas.push({
        group: limpiarGrupo(fila.group),
        team_id: fila.team?.id,
        team: fila.team?.name,
        rank_inicial: fila.rank ?? '',
      });
    }
  }
  return filas;
}

function limpiarGrupo(g) {
  if (!g) return '';
  const m = String(g).match(/Group\s+([A-L])/i);
  return m ? m[1].toUpperCase() : String(g);
}

// fixtures.csv (torneo final): el grupo se deriva del equipo (ambos comparten grupo).
export function normalizarFixtures(response, teamGroup) {
  return response.map((it) => {
    const homeId = it.teams?.home?.id;
    const awayId = it.teams?.away?.id;
    return {
      fixture_id: it.fixture?.id,
      fecha: it.fixture?.date || '',
      round: it.league?.round || '',
      group: teamGroup.get(homeId) || teamGroup.get(awayId) || '',
      home_id: homeId,
      home: it.teams?.home?.name,
      away_id: awayId,
      away: it.teams?.away?.name,
      venue_name: it.fixture?.venue?.name || '',
      venue_city: it.fixture?.venue?.city || '',
      status: it.fixture?.status?.short || '',
    };
  });
}

// quali_results.csv: de /fixtures de una eliminatoria. Solo partidos FINALIZADOS
// con marcador valido (no se inventan resultados de partidos no jugados).
export function normalizarResultados(response, confederacion, estadosOk = ESTADOS_FINALIZADO) {
  const filas = [];
  for (const it of response) {
    const status = it.fixture?.status?.short || '';
    const gh = it.goals?.home;
    const ga = it.goals?.away;
    if (!estadosOk.includes(status)) continue; // aun no jugado / suspendido / etc.
    if (typeof gh !== 'number' || typeof ga !== 'number') continue; // sin marcador valido
    filas.push({
      fixture_id: it.fixture?.id,
      fecha: it.fixture?.date || '',
      confederacion,
      league_id: it.league?.id,
      season: it.league?.season,
      round: it.league?.round || '',
      home_id: it.teams?.home?.id,
      home: it.teams?.home?.name,
      away_id: it.teams?.away?.id,
      away: it.teams?.away?.name,
      goles_local: gh,
      goles_visita: ga,
      status,
    });
  }
  return filas;
}

// Resuelve los league id de las eliminatorias desde la respuesta de /leagues.
// Devuelve [{ confederacion, id, name, seasons:[years...] }]. Reporta no resueltas.
export function resolverLigas(leaguesResponse, qualifiers = QUALIFIERS, ciclo = CICLO_SEASONS) {
  const resueltas = [];
  const noResueltas = [];
  for (const q of qualifiers) {
    const match = leaguesResponse.find((it) => q.patron.test(it.league?.name || ''));
    if (!match) { noResueltas.push(q.confederacion); continue; }
    const yearsDisponibles = (match.seasons || []).map((s) => s.year);
    const seasons = ciclo.filter((y) => yearsDisponibles.includes(y));
    resueltas.push({ confederacion: q.confederacion, id: match.league.id, name: match.league.name, seasons });
  }
  return { resueltas, noResueltas };
}

// --- Escritura --------------------------------------------------------------

function escribirCSV(nombre, filas, columnas) {
  asegurarDir(PATHS.out);
  const ruta = path.join(PATHS.out, nombre);
  fs.writeFileSync(ruta, aCSV(filas, columnas));
  info(`Escrito ${ruta} (${filas.length} filas).`);
}

// --- Orquestacion -----------------------------------------------------------

async function main() {
  info('=== FASE 1: extraccion API-Football (eliminatorias + torneo final) ===');

  // (A) Resolver ligas de eliminatorias en runtime
  const leagues = await apiGet('leagues', { search: 'world cup' });
  guardarCrudo('leagues', { ...leagues.meta, response: leagues.response, results: leagues.results });
  const { resueltas, noResueltas } = resolverLigas(leagues.response);
  info(`Eliminatorias resueltas: ${resueltas.map((r) => `${r.confederacion}#${r.id}[${r.seasons.join('/')}]`).join(', ') || 'ninguna'}.`);
  if (noResueltas.length) {
    warn(`Confederaciones NO resueltas en /leagues (se omiten, no se inventan): ${noResueltas.join(', ')}.`);
  }
  if (resueltas.length === 0) {
    throw new Error('No se resolvio ninguna eliminatoria desde /leagues. Revisa nombres/patrones o cobertura del plan API.');
  }

  // (B) Bajar resultados de cada eliminatoria/temporada del ciclo
  const resultados = [];
  for (const liga of resueltas) {
    if (liga.seasons.length === 0) {
      warn(`${liga.confederacion} (#${liga.id}): /leagues no reporta temporadas del ciclo ${CICLO_SEASONS.join('/')}. Se omite.`);
      continue;
    }
    for (const season of liga.seasons) {
      const fx = await apiGet('fixtures', { league: liga.id, season });
      guardarCrudo(`quali_${liga.confederacion}_${season}`, { ...fx.meta, response: fx.response, results: fx.results });
      const filas = normalizarResultados(fx.response, liga.confederacion);
      info(`${liga.confederacion} ${season}: ${fx.results} fixtures, ${filas.length} finalizados con marcador.`);
      resultados.push(...filas);
    }
  }
  if (resultados.length === 0) {
    throw new Error('No se obtuvo ningun resultado de eliminatorias. No hay base para estimar fuerzas (Fase 2).');
  }

  // (C) Torneo final: equipos, grupos, fixtures
  const finalParams = { league: API.finalLeagueId, season: API.season };
  const teams = await apiGet('teams', finalParams);
  guardarCrudo('teams', { ...teams.meta, response: teams.response, results: teams.results });
  const teamsRows = normalizarTeams(teams.response);
  if (teamsRows.length !== TORNEO.equipos) warn(`Equipos del torneo final: ${teamsRows.length} (esperados ${TORNEO.equipos}).`);

  const standings = await apiGet('standings', finalParams);
  guardarCrudo('standings', { ...standings.meta, response: standings.response, results: standings.results });
  const groupsRows = normalizarGroups(standings.response);
  if (groupsRows.length === 0) warn('Standings VACIO: la estructura de grupos aun no esta publicada. fixtures.group quedara vacio. ANOTADO.');
  const teamGroup = new Map(groupsRows.filter((r) => r.team_id).map((r) => [r.team_id, r.group]));

  const fixtures = await apiGet('fixtures', finalParams);
  guardarCrudo('fixtures', { ...fixtures.meta, response: fixtures.response, results: fixtures.results });
  const fixturesRows = normalizarFixtures(fixtures.response, teamGroup);
  if (fixturesRows.length !== TORNEO.partidosTotales) warn(`Partidos del torneo final: ${fixturesRows.length} (esperados ${TORNEO.partidosTotales}).`);

  // (D) Escritura de tablas limpias
  escribirCSV('quali_results.csv', resultados, [
    'fixture_id', 'fecha', 'confederacion', 'league_id', 'season', 'round',
    'home_id', 'home', 'away_id', 'away', 'goles_local', 'goles_visita', 'status',
  ]);
  escribirCSV('teams.csv', teamsRows, ['team_id', 'team', 'code', 'country']);
  escribirCSV('groups.csv', groupsRows, ['group', 'team_id', 'team', 'rank_inicial']);
  escribirCSV('fixtures.csv', fixturesRows, [
    'fixture_id', 'fecha', 'round', 'group', 'home_id', 'home', 'away_id', 'away',
    'venue_name', 'venue_city', 'status',
  ]);

  info(`=== FASE 1 completa. Resultados eliminatorias: ${resultados.length}. Requests usados: ${requestsUsados()}/${API.maxRequestsPorCorrida} ===`);
}

const invocadoDirecto = import.meta.url === `file://${process.argv[1]}`;
if (invocadoDirecto) {
  main().catch((e) => {
    console.error(`\nEXTRACCION ABORTADA: ${e.message}\n`);
    process.exit(1);
  });
}

export { main };
