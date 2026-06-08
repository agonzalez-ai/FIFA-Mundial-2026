// cache.js — Lectura/escritura de cache crudo en disco (JSON con timestamp).
// Permite re-correr el modelo SIN volver a llamar la API.

import fs from 'node:fs';
import path from 'node:path';
import { PATHS } from '../config.js';

// Crea un directorio si no existe (recursivo).
export function asegurarDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

// Guarda una respuesta cruda como JSON con timestamp y actualiza un puntero "_latest".
// Devuelve la ruta del archivo timestamped escrito.
// payload debe incluir metadatos de trazabilidad (endpoint, fecha, etc.).
export function guardarCrudo(nombre, payload) {
  asegurarDir(PATHS.raw);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const archivoTs = path.join(PATHS.raw, `${nombre}_${ts}.json`);
  const archivoLatest = path.join(PATHS.raw, `${nombre}_latest.json`);
  const texto = JSON.stringify(payload, null, 2);
  fs.writeFileSync(archivoTs, texto);
  fs.writeFileSync(archivoLatest, texto);
  return archivoTs;
}

// Lee el ultimo crudo guardado para un nombre dado. Lanza error claro si falta.
export function leerCrudoLatest(nombre) {
  const archivo = path.join(PATHS.raw, `${nombre}_latest.json`);
  if (!fs.existsSync(archivo)) {
    throw new Error(
      `No existe cache crudo "${archivo}". Corre primero "npm run extract" con tu APIFOOTBALL_KEY.`
    );
  }
  return JSON.parse(fs.readFileSync(archivo, 'utf8'));
}
