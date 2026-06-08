// names.js — Normalizacion de nombres de selecciones y join entre fuentes.
//
// Las fuentes externas (eloratings.net, ranking FIFA) usan nombres distintos a
// los nombres canonicos de API-Football. Aqui normalizamos y mantenemos un mapa
// de alias DOCUMENTADO para los casos que no casan por normalizacion simple.
// Esto NO inventa datos: solo reconcilia nombres del MISMO equipo.

// Quita acentos, baja a minusculas, elimina puntuacion y colapsa espacios.
export function normalizar(nombre) {
  return String(nombre || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // acentos
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[.\-'']/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Alias DOCUMENTADO: nombre-externo-normalizado -> nombre-canonico-normalizado.
// Cubre divergencias conocidas entre eloratings/FIFA y API-Football.
// Ampliable: si en runtime queda un equipo sin casar, se REPORTA (no se inventa).
export const ALIAS = new Map(Object.entries({
  'united states': 'usa',
  'united states of america': 'usa',
  'south korea': 'korea republic',
  'korea south': 'korea republic',
  'north korea': 'korea dpr',
  'ivory coast': 'cote d ivoire',
  'czechia': 'czech republic',
  'turkiye': 'turkey',
  'aotearoa new zealand': 'new zealand',
  'korea republic': 'south korea',
  'ir iran': 'iran',
  'cote d ivoire': 'ivory coast',
  'cabo verde': 'cape verde',
  'usa': 'united states',
  'congo dr': 'dr congo',
  'cape verde': 'cabo verde',
  'iran': 'ir iran',
  'china': 'china pr',
  'curacao': 'curacao',
  'dr congo': 'congo dr',
  'republic of ireland': 'ireland',
  'bosnia': 'bosnia and herzegovina',
  'st kitts and nevis': 'saint kitts and nevis',
}).map(([k, v]) => [normalizar(k), normalizar(v)]));

// Devuelve la forma normalizada canonica para un nombre externo, aplicando alias.
export function canonizar(nombreExterno) {
  const n = normalizar(nombreExterno);
  return ALIAS.get(n) || n;
}

// Construye un indice normalizado de los equipos canonicos (de teams.csv).
// Devuelve Map<normalizado, {team_id, team}>.
export function indexarEquipos(teamsRows) {
  const idx = new Map();
  for (const t of teamsRows) {
    idx.set(normalizar(t.team), { team_id: t.team_id, team: t.team });
  }
  return idx;
}

// Casa un nombre externo contra el indice canonico. Devuelve el equipo o null.
export function casar(nombreExterno, idxEquipos) {
  const directo = idxEquipos.get(normalizar(nombreExterno));
  if (directo) return directo;
  const viaAlias = idxEquipos.get(canonizar(nombreExterno));
  return viaAlias || null;
}
