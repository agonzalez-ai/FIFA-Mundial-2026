// apiClient.js — Cliente axios para API-Football v3 con guard de rate-limit
// y logging de cada endpoint. Lee la key de process.env.APIFOOTBALL_KEY.

import axios from 'axios';
import { API } from '../config.js';
import { info, warn, error } from './logger.js';

let requestsRealizados = 0;

// Construye el header de auth segun el modo configurado.
function headersAuth() {
  const key = process.env.APIFOOTBALL_KEY;
  if (!key) {
    throw new Error(
      'Falta APIFOOTBALL_KEY en el entorno. Define la variable antes de "npm run extract" (ver .env.example).'
    );
  }
  // API-Sports directo usa x-apisports-key; via RapidAPI usa x-rapidapi-key.
  if (API.authMode === 'rapidapi') {
    return {
      'x-rapidapi-key': key,
      'x-rapidapi-host': 'v3.football.api-sports.io',
    };
  }
  return { 'x-apisports-key': key };
}

// Realiza un GET a un endpoint v3. Devuelve { response, results, errors, meta }.
// - Respeta el presupuesto de requests por corrida (lanza error si se excede).
// - Loggea endpoint, parametros, timestamp y nro de resultados.
// - NO inventa datos: si la API responde vacio, lo reporta tal cual.
export async function apiGet(endpoint, params = {}) {
  if (requestsRealizados >= API.maxRequestsPorCorrida) {
    throw new Error(
      `Presupuesto de requests agotado (${API.maxRequestsPorCorrida}). Aborto para no gastar cuota.`
    );
  }
  const url = `${API.baseURL}/${endpoint}`;
  const qs = new URLSearchParams(params).toString();
  requestsRealizados += 1;
  info(`GET ${endpoint}?${qs} (request ${requestsRealizados}/${API.maxRequestsPorCorrida})`);

  let res;
  try {
    res = await axios.get(url, { headers: headersAuth(), params, timeout: 30000 });
  } catch (e) {
    const detalle = e.response ? `HTTP ${e.response.status}` : e.message;
    error(`Fallo GET ${endpoint}: ${detalle}`);
    throw new Error(`Extraccion fallida en ${endpoint}: ${detalle}`);
  }

  const data = res.data || {};
  // API-Football devuelve errores de negocio en data.errors (objeto o array).
  const errores = data.errors;
  const tieneErrores = errores && (Array.isArray(errores) ? errores.length : Object.keys(errores).length);
  if (tieneErrores) {
    error(`API reporto errores en ${endpoint}: ${JSON.stringify(errores)}`);
    throw new Error(`API-Football devolvio errores en ${endpoint}: ${JSON.stringify(errores)}`);
  }

  const response = data.response || [];
  const results = typeof data.results === 'number' ? data.results : response.length;
  if (results === 0) {
    warn(`Respuesta VACIA en ${endpoint} (results=0). Se registra y NO se rellena con datos inventados.`);
  } else {
    info(`OK ${endpoint}: ${results} resultados.`);
  }

  return {
    response,
    results,
    errors: errores || null,
    meta: {
      endpoint,
      params,
      extraidoEn: new Date().toISOString(),
      requestNumero: requestsRealizados,
    },
  };
}

export function requestsUsados() {
  return requestsRealizados;
}
