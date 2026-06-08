// extract.js — FASE 1: extraccion desde API-Football y normalizacion a CSV.
//
// Endpoints (3 requests, muy por debajo del presupuesto de 20):
//   teams?league=1&season=2026     -> 48 selecciones (IDs y nombres canonicos)
//   standings?league=1&season=2026 -> estructura de los 12 grupos (equipo -> grupo)
//   fixtures?league=1&season=2026  -> 104 partidos
//
// Salidas: data/raw/*_{ts}.json (crudo versionado) y data/out/{teams,groups,fixtures}.csv
//
// Reglas de integridad: nunca rellena datos faltantes; loggea cada endpoint;
// maneja respuestas vacias sin romper y lo deja anotado en el log.

import fs from 'node:fs';
import path from 'node:path';
import { apiGet, requestsUsados } from './lib/apiClient.js';
import { guardarCrudo, asegurarDir } from './lib/cache.js';
import { aCSV } from './lib/csv.js';
import { info, warn } from './lib/logger.js';
import { API, PATHS } from './config.js';

// --- Normalizadores (funciones puras) -------------------------------------

// teams.csv: a partir de la respuesta de /teams (cada item = { team, venue }).
export function normalizarTeams(response) {
  return response.map((it) => ({
    team_id: it.team?.id,
    team: it.team?.name,
    code: it.team?.code || '',
    country: it.team?.country || '',
  }));
}

// groups.csv: a partir de /standings. response[0].league.standings = array de grupos,
// cada grupo es un array de filas con { team:{id,name}, group:"Group A" }.
export function normalizarGroups(response) {
  const liga = response[0]?.league;
  const grupos = liga?.standings || [];
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

// Convierte "Group A" -> "A"; deja intacto si ya viene como letra.
function limpiarGrupo(g) {
  if (!g) return '';
  const m = String(g).match(/Group\s+([A-L])/i);
  return m ? m[1].toUpperCase() : String(g);
}

// fixtures.csv: a partir de /fixtures. El grupo del partido se deriva del
// equipo (ambos equipos comparten grupo en fase de grupos) usando teamGroup.
export function normalizarFixtures(response, teamGroup) {
  return response.map((it) => {
    const homeId = it.teams?.home?.id;
    const awayId = it.teams?.away?.id;
    const grupo = teamGroup.get(homeId) || teamGroup.get(awayId) || '';
    return {
      fixture_id: it.fixture?.id,
      fecha: it.fixture?.date || '',
      round: it.league?.round || '',
      group: grupo, // vacio si es ronda eliminatoria (no fase de grupos)
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

// --- Escritura de salidas ---------------------------------------------------

function escribirCSV(nombre, filas, columnas) {
  asegurarDir(PATHS.out);
  const ruta = path.join(PATHS.out, nombre);
  fs.writeFileSync(ruta, aCSV(filas, columnas));
  info(`Escrito ${ruta} (${filas.length} filas).`);
}

// --- Orquestacion -----------------------------------------------------------

async function main() {
  info('=== FASE 1: extraccion API-Football (Mundial 2026) ===');
  const baseParams = { league: API.leagueId, season: API.season };

  // 1) Teams
  const teams = await apiGet('teams', baseParams);
  guardarCrudo('teams', { ...teams.meta, response: teams.response, results: teams.results });
  const teamsRows = normalizarTeams(teams.response);
  if (teamsRows.length !== 48) {
    warn(`Se esperaban 48 selecciones y llegaron ${teamsRows.length}. Se escribe lo recibido sin rellenar.`);
  }

  // 2) Standings (estructura de grupos)
  const standings = await apiGet('standings', baseParams);
  guardarCrudo('standings', { ...standings.meta, response: standings.response, results: standings.results });
  const groupsRows = normalizarGroups(standings.response);
  if (groupsRows.length === 0) {
    warn('Standings VACIO: la API aun no expone la estructura de grupos. fixtures.group quedara vacio. ANOTADO.');
  }

  // Mapa team_id -> grupo, para etiquetar los fixtures de fase de grupos.
  const teamGroup = new Map(groupsRows.filter((r) => r.team_id).map((r) => [r.team_id, r.group]));

  // 3) Fixtures
  const fixtures = await apiGet('fixtures', baseParams);
  guardarCrudo('fixtures', { ...fixtures.meta, response: fixtures.response, results: fixtures.results });
  const fixturesRows = normalizarFixtures(fixtures.response, teamGroup);
  if (fixturesRows.length !== 104) {
    warn(`Se esperaban 104 partidos y llegaron ${fixturesRows.length}. Se escribe lo recibido sin rellenar.`);
  }

  // Escritura de tablas limpias
  escribirCSV('teams.csv', teamsRows, [
    { key: 'team_id', header: 'team_id' },
    { key: 'team', header: 'team' },
    { key: 'code', header: 'code' },
    { key: 'country', header: 'country' },
  ]);
  escribirCSV('groups.csv', groupsRows, [
    { key: 'group', header: 'group' },
    { key: 'team_id', header: 'team_id' },
    { key: 'team', header: 'team' },
    { key: 'rank_inicial', header: 'rank_inicial' },
  ]);
  escribirCSV('fixtures.csv', fixturesRows, [
    { key: 'fixture_id', header: 'fixture_id' },
    { key: 'fecha', header: 'fecha' },
    { key: 'round', header: 'round' },
    { key: 'group', header: 'group' },
    { key: 'home_id', header: 'home_id' },
    { key: 'home', header: 'home' },
    { key: 'away_id', header: 'away_id' },
    { key: 'away', header: 'away' },
    { key: 'venue_name', header: 'venue_name' },
    { key: 'venue_city', header: 'venue_city' },
    { key: 'status', header: 'status' },
  ]);

  info(`=== FASE 1 completa. Requests usados: ${requestsUsados()}/${API.maxRequestsPorCorrida} ===`);
}

// Solo ejecuta la extraccion en vivo si el script se invoca directamente
// (asi los normalizadores puros pueden importarse y testearse sin llamar la API).
const invocadoDirecto = import.meta.url === `file://${process.argv[1]}`;
if (invocadoDirecto) {
  main().catch((e) => {
    // Falla con error claro (regla de integridad): no continua con datos parciales silenciosos.
    console.error(`\nEXTRACCION ABORTADA: ${e.message}\n`);
    process.exit(1);
  });
}
