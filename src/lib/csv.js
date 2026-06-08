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

// Parsea texto delimitado (CSV o TSV) respetando comillas dobles RFC 4180.
// Devuelve un array de arrays de strings (filas de celdas), sin interpretar cabecera.
export function parseDelimitado(texto, sep = ',') {
  const filas = [];
  let campo = '';
  let fila = [];
  let enComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; } // comilla escapada
        else enComillas = false;
      } else campo += c;
    } else if (c === '"') {
      enComillas = true;
    } else if (c === sep) {
      fila.push(campo); campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++; // CRLF
      fila.push(campo); campo = '';
      filas.push(fila); fila = [];
    } else {
      campo += c;
    }
  }
  // Ultima celda/fila si el texto no termina en salto de linea
  if (campo.length > 0 || fila.length > 0) { fila.push(campo); filas.push(fila); }
  // Descarta filas totalmente vacias
  return filas.filter((f) => f.some((x) => x.trim() !== ''));
}

// Lee un archivo delimitado con cabecera y devuelve array de objetos keyados por header.
export function objetosDesdeDelimitado(texto, sep = ',') {
  const filas = parseDelimitado(texto, sep);
  if (filas.length === 0) return { headers: [], rows: [] };
  const headers = filas[0].map((h) => h.trim());
  const rows = filas.slice(1).map((f) => {
    const o = {};
    headers.forEach((h, i) => { o[h] = (f[i] ?? '').trim(); });
    return o;
  });
  return { headers, rows };
}
