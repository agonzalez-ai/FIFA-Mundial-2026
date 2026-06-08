// logger.js — Bitacora simple a consola y a logs/extract.log.
// Cada extraccion registra fecha/hora, endpoint usado y resultado.

import fs from 'node:fs';
import path from 'node:path';
import { PATHS } from '../config.js';

const ARCHIVO_LOG = path.join(PATHS.logs, 'extract.log');

// Escribe una linea con timestamp tanto a stdout como al archivo de log.
export function log(nivel, mensaje) {
  fs.mkdirSync(PATHS.logs, { recursive: true });
  const linea = `${new Date().toISOString()} [${nivel}] ${mensaje}`;
  console.log(linea);
  fs.appendFileSync(ARCHIVO_LOG, linea + '\n');
}

export const info = (m) => log('INFO', m);
export const warn = (m) => log('WARN', m);
export const error = (m) => log('ERROR', m);
