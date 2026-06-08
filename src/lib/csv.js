// csv.js — Escritor CSV minimalista, sin dependencias. Funciones puras.

// Escapa un valor segun RFC 4180: comillas dobles si contiene coma, comilla o salto.
function escaparCampo(valor) {
  const s = valor === null || valor === undefined ? '' : String(valor);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// Convierte un array de objetos a texto CSV dado un orden de columnas explicito.
// columnas: [{ key, header }] o ['key1','key2'] (header = key).
export function aCSV(filas, columnas) {
  const cols = columnas.map((c) => (typeof c === 'string' ? { key: c, header: c } : c));
  const cabecera = cols.map((c) => escaparCampo(c.header)).join(',');
  const lineas = filas.map((fila) => cols.map((c) => escaparCampo(fila[c.key])).join(','));
  return [cabecera, ...lineas].join('\n') + '\n';
}
