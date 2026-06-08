// venues.js — Mapa sede -> pais anfitrion (Mundial 2026, 16 sedes verificadas) y
// determinacion de la ventaja de localia (HFA) por partido.
//
// Decision acordada: +65 Elo al equipo cuyo PAIS coincide con el pais de la sede,
// SOLO si ese pais es anfitrion (USA/Mexico/Canada). 0 en cualquier otro caso.
// Mejora el proxy anterior: el +65 va al anfitrion aunque figure como visitante.
//
// Fuente de sedes: anuncio oficial FIFA de las 16 sedes del Mundial 2026.

import { normalizar } from './names.js';
import { MODELO } from '../config.js';

// Palabras clave (ciudad o estadio) -> pais. Se casa por substring normalizado,
// para tolerar variantes de venue_city/venue_name de API-Football.
const SEDES = [
  // --- USA (11) ---
  ['atlanta', 'USA'], ['mercedes benz', 'USA'],
  ['foxborough', 'USA'], ['gillette', 'USA'], ['boston', 'USA'],
  ['arlington', 'USA'], ['at t stadium', 'USA'], ['dallas', 'USA'],
  ['houston', 'USA'], ['nrg', 'USA'],
  ['kansas city', 'USA'], ['arrowhead', 'USA'],
  ['inglewood', 'USA'], ['sofi', 'USA'], ['los angeles', 'USA'],
  ['miami', 'USA'], ['hard rock', 'USA'],
  ['east rutherford', 'USA'], ['metlife', 'USA'], ['new york', 'USA'], ['new jersey', 'USA'],
  ['philadelphia', 'USA'], ['lincoln financial', 'USA'],
  ['santa clara', 'USA'], ['levi', 'USA'], ['san francisco', 'USA'], ['bay area', 'USA'],
  ['seattle', 'USA'], ['lumen', 'USA'],
  // --- Mexico (3) ---
  ['mexico city', 'Mexico'], ['ciudad de mexico', 'Mexico'], ['azteca', 'Mexico'], ['banorte', 'Mexico'],
  ['guadalajara', 'Mexico'], ['zapopan', 'Mexico'], ['akron', 'Mexico'],
  ['monterrey', 'Mexico'], ['bbva', 'Mexico'],
  // --- Canada (2) ---
  ['toronto', 'Canada'], ['bmo field', 'Canada'],
  ['vancouver', 'Canada'], ['bc place', 'Canada'],
];

// Determina el pais de la sede a partir de ciudad y/o nombre del estadio.
// Devuelve 'USA' | 'Mexico' | 'Canada' | '' (desconocido).
export function paisDeSede(venueCity = '', venueName = '') {
  const hay = `${normalizar(venueCity)} ${normalizar(venueName)}`;
  for (const [clave, pais] of SEDES) {
    if (hay.includes(clave)) return pais;
  }
  return '';
}

// Mapea un equipo a su pais anfitrion si lo es, comparando nombre y/o country.
// Devuelve 'USA' | 'Mexico' | 'Canada' | '' .
export function paisAnfitrionDeEquipo(team = '', country = '') {
  const t = normalizar(team);
  const c = normalizar(country);
  const hosts = { usa: 'USA', 'united states': 'USA', mexico: 'Mexico', canada: 'Canada' };
  for (const [clave, pais] of Object.entries(hosts)) {
    if (t === normalizar(clave) || c === normalizar(clave)) return pais;
  }
  return '';
}

// HFA con signo, en puntos Elo, a sumar al LOCAL: +65 si el local juega en su
// pais anfitrion; -65 si el VISITANTE es anfitrion jugando en su pais; 0 si no.
export function hfaDePartido(home, homeCountry, away, awayCountry, venueCity, venueName, params = MODELO) {
  const sede = paisDeSede(venueCity, venueName);
  if (!sede) return 0;
  if (paisAnfitrionDeEquipo(home, homeCountry) === sede) return params.hfaEloAnfitrion;
  if (paisAnfitrionDeEquipo(away, awayCountry) === sede) return -params.hfaEloAnfitrion;
  return 0;
}
