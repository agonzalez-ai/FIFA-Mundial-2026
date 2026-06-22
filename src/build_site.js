// build_site.js — Genera un sitio estatico (site/) con el pronostico, a partir de
// los CSV de data/out. Reproducible: `npm run site`. Sin dependencias externas;
// HTML autocontenido con CSS embebido. Pensado para desplegar en Netlify.

import fs from 'node:fs';
import path from 'node:path';
import { objetosDesdeDelimitado } from './lib/csv.js';
import { PATHS } from './config.js';

const SITE = 'site';
const OUT = PATHS.out;

function leer(nombre) {
  const ruta = path.join(OUT, nombre);
  if (!fs.existsSync(ruta)) throw new Error(`Falta ${ruta}. Corre "npm run simulate" primero.`);
  return objetosDesdeDelimitado(fs.readFileSync(ruta, 'utf8'), ',').rows;
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (v) => `${(Number(v) * 100).toFixed(1)}%`;
const pct0 = (v) => `${(Number(v) * 100).toFixed(0)}%`;

function tabla(headers, filas) {
  const th = headers.map((h) => `<th>${esc(h)}</th>`).join('');
  const tr = filas.map((f) => `<tr>${f.map((c, i) => `<td${i === 0 ? ' class="l"' : ''}>${c}</td>`).join('')}</tr>`).join('');
  return `<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

function main() {
  const ko = leer('knockout_probs.csv').sort((a, b) => Number(b.p_campeon) - Number(a.p_campeon));
  const gp = leer('group_probs.csv');
  const mp = leer('match_probs.csv');
  const dc = JSON.parse(fs.readFileSync(path.join(OUT, 'dc_params.json'), 'utf8'));

  const campeon = ko[0];
  const podio = [...ko].sort((a, b) => Number(b.p_podio) - Number(a.p_podio)).slice(0, 3);

  // Podio destacado
  const podioCards = podio.map((t, i) => `
    <div class="card">
      <div class="medal">${['🥇', '🥈', '🥉'][i]}</div>
      <div class="team">${esc(t.team)}</div>
      <div class="prob">${pct(t.p_podio)} <span>podio</span></div>
    </div>`).join('');

  // Tabla de contendientes (top 12 por titulo)
  const koTabla = tabla(['Equipo', 'Semis', 'Final', '🏆 Campeón', 'Podio'],
    ko.slice(0, 12).map((r) => [esc(r.team), pct(r.p_sf), pct(r.p_final), `<b>${pct(r.p_campeon)}</b>`, pct(r.p_podio)]));

  // Avance por grupo
  const grupos = [...new Set(gp.map((r) => r.group))].sort();
  const gruposHTML = grupos.map((g) => {
    const filas = gp.filter((r) => r.group === g).sort((a, b) => Number(b.p_avanza) - Number(a.p_avanza))
      .map((r) => [esc(r.team), pct0(r.p_1), pct0(r.p_top2), `<b>${pct0(r.p_avanza)}</b>`]);
    return `<div class="grp"><h3>Grupo ${g}</h3>${tabla(['Equipo', '1º', 'Top-2', 'Avanza'], filas)}</div>`;
  }).join('');

  // Predicciones por partido
  const partidosHTML = grupos.map((g) => {
    const filas = mp.filter((r) => r.group === g).map((r) => [
      `${esc(r.home)} vs ${esc(r.away)}`, `${r.xg_home}–${r.xg_away}`,
      pct0(r.p_local), pct0(r.p_empate), pct0(r.p_visita), pct0(r.p_mas25), `<b>${esc(r.marcador)}</b>`]);
    return `<div class="grp"><h3>Grupo ${g}</h3>${tabla(['Partido', 'xG', '1', 'X', '2', '+2.5', 'Marcador'], filas)}</div>`;
  }).join('');

  const html = `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pronóstico Mundial FIFA 2026</title>
<style>
  :root { --bg:#0b132b; --pan:#1c2541; --ac:#5bc0be; --tx:#e8eef2; --mut:#9bb3c7; }
  * { box-sizing:border-box; } body { margin:0; background:var(--bg); color:var(--tx);
    font:15px/1.5 system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif; }
  header { background:linear-gradient(135deg,#1c2541,#3a506b); padding:40px 20px; text-align:center; }
  header h1 { margin:0 0 8px; font-size:28px; } header p { margin:4px 0; color:var(--mut); }
  main { max-width:1000px; margin:0 auto; padding:24px 16px 60px; }
  section { background:var(--pan); border-radius:12px; padding:20px; margin:18px 0; }
  h2 { color:var(--ac); border-bottom:1px solid #2b3a55; padding-bottom:8px; margin-top:0; }
  .podium { display:flex; gap:14px; justify-content:center; flex-wrap:wrap; }
  .card { background:#0e1730; border:1px solid #2b3a55; border-radius:12px; padding:18px 26px; text-align:center; min-width:160px; }
  .medal { font-size:34px; } .card .team { font-size:19px; font-weight:700; margin:6px 0; }
  .card .prob { color:var(--ac); font-size:20px; font-weight:700; } .card .prob span { color:var(--mut); font-size:12px; font-weight:400; }
  .champ { text-align:center; font-size:22px; margin:10px 0 22px; } .champ b { color:var(--ac); }
  table { width:100%; border-collapse:collapse; margin:6px 0; font-size:14px; }
  th,td { padding:6px 8px; text-align:right; border-bottom:1px solid #2b3a55; }
  th { color:var(--mut); font-weight:600; } td.l,th:first-child { text-align:left; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:14px; }
  .grp h3 { color:var(--ac); margin:6px 0; font-size:16px; }
  .muted { color:var(--mut); font-size:13px; } a { color:var(--ac); }
  .dl a { display:inline-block; margin:4px 10px 4px 0; }
</style></head>
<body>
<header>
  <h1>⚽ Pronóstico Mundial FIFA 2026</h1>
  <p>Modelo Dixon-Coles sobre <b>resultados reales</b> (eliminatorias + amistosos 2023–2026) · simulación Monte Carlo de 50.000 torneos</p>
  <p class="muted">Ventaja de local h=${dc.h.toFixed(2)} · ρ=${dc.rho.toFixed(2)} · corte ${esc(dc.fecha_corte)}</p>
</header>
<main>
  <section>
    <h2>🏆 Campeón y podio</h2>
    <div class="champ">Campeón más probable: <b>${esc(campeon.team)}</b> (${pct(campeon.p_campeon)})</div>
    <div class="podium">${podioCards}</div>
    <p class="muted" style="text-align:center;margin-top:16px">Los 3 con mayor probabilidad de subir al podio. Un Mundial de 48 equipos es muy abierto: hasta el favorito ronda ~8% de título.</p>
  </section>
  <section><h2>Contendientes al título (top 12)</h2>${koTabla}</section>
  <section><h2>Avance por grupo</h2><div class="grid">${gruposHTML}</div></section>
  <section><h2>Predicciones por partido</h2>
    <p class="muted">xG = goles esperados · 1/X/2 = prob. de resultado · +2.5 = prob. de 3+ goles · Marcador = muestreado condicionado al favorito.</p>
    <div class="grid">${partidosHTML}</div>
  </section>
  <section>
    <h2>Metodología y descargas</h2>
    <p class="muted">Fuerza ataque/defensa ajustada por máxima verosimilitud (Dixon-Coles) a resultados reales; ancla de ranking FIFA para comparabilidad entre confederaciones; desempates oficiales FIFA 2026 (head-to-head primero). El cuadro de eliminación es una aproximación del formato publicado (no la asignación exacta Annex C de FIFA). No es asesoría de apuestas.</p>
    <p class="dl">
      <a href="reporte.md">📄 reporte.md</a>
      <a href="match_probs.csv">match_probs.csv</a>
      <a href="group_probs.csv">group_probs.csv</a>
      <a href="knockout_probs.csv">knockout_probs.csv</a>
      <a href="ratings.csv">ratings.csv</a>
    </p>
    <p class="muted">Generado: ${new Date().toISOString()}</p>
  </section>
</main>
</body></html>`;

  fs.mkdirSync(SITE, { recursive: true });
  fs.writeFileSync(path.join(SITE, 'index.html'), html);
  for (const f of ['reporte.md', 'match_probs.csv', 'group_probs.csv', 'knockout_probs.csv', 'ratings.csv']) {
    if (fs.existsSync(path.join(OUT, f))) fs.copyFileSync(path.join(OUT, f), path.join(SITE, f));
  }
  console.log(`Sitio generado en ${SITE}/ (index.html + CSVs).`);
}

main();
