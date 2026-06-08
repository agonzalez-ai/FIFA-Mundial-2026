// dixoncoles.js — Estimacion de fuerza ataque/defensa por seleccion ajustando un
// modelo Poisson Dixon-Coles (1997) a los RESULTADOS de las eliminatorias.
//
// MODELO (cada parametro documentado en config.RATINGS.dc y en el README):
//   log λ_local   = base + h + ataque_i + defensa_j      (i=local, j=visitante)
//   log λ_visita  = base     + ataque_j + defensa_i
//   - ataque_t : tendencia goleadora de t   (mayor => marca mas)
//   - defensa_t: debilidad defensiva de t    (mayor => le marcan mas)
//   - h        : ventaja de local (global, estimada de los datos)
//   - base     : nivel de goles de referencia
//   Identificabilidad: media(ataque)=0 y media(defensa)=0 (h y base toman el nivel).
//   Correccion Dixon-Coles τ(x,y;λ,μ,ρ) para marcadores bajos (0/1), parametro ρ.
//   Ponderacion temporal: cada partido pesa w_k = exp(-ξ·Δt) (recientes pesan mas).
//
// ANCLA DE COMPARABILIDAD (clave): las eliminatorias son casi intra-confederacion,
// asi que el nivel RELATIVO entre confederaciones no esta identificado por los
// datos (es una direccion plana de la verosimilitud). Un prior por equipo sobre el
// rating neto r_t = ataque_t - defensa_t, atraido al valor implicado por el ranking
// FIFA (z-score · sigma), fija ese nivel. Peso eta. Documentado, no es dato principal.
//
// Optimizacion: ascenso de gradiente sobre la log-verosimilitud ponderada y
// penalizada, con gradientes analiticos (incluida la correccion τ). Node puro.

// Correccion Dixon-Coles y sus derivadas para un marcador (x,y) con tasas (lh, la).
// Devuelve { tau, dlogTau_dlh, dlogTau_dla, dlogTau_drho } (0 si no es marcador bajo).
function tauDC(x, y, lh, la, rho) {
  let tau = 1, dlh = 0, dla = 0, drho = 0;
  if (x === 0 && y === 0) { tau = 1 - lh * la * rho; dlh = -la * rho; dla = -lh * rho; drho = -lh * la; }
  else if (x === 0 && y === 1) { tau = 1 + lh * rho; dlh = rho; drho = lh; }
  else if (x === 1 && y === 0) { tau = 1 + la * rho; dla = rho; drho = la; }
  else if (x === 1 && y === 1) { tau = 1 - rho; drho = -1; }
  else return { tau: 1, dlogTau_dlh: 0, dlogTau_dla: 0, dlogTau_drho: 0 };
  const t = Math.max(tau, 1e-6);
  return { tau: t, dlogTau_dlh: dlh / t, dlogTau_dla: dla / t, dlogTau_drho: drho / t };
}

// Ajusta el modelo. matches: [{homeId, awayId, gh, ga, weight}].
// opciones: { fifaZ: Map<id, z>, eta, sigma, ridge, lr, iters, rhoMax }.
// Devuelve { base, h, rho, ataque: Map<id,num>, defensa: Map<id,num>, ids, nMatches, ll }.
export function ajustar(matches, opciones = {}) {
  const { fifaZ = new Map(), eta = 0.1, sigma = 0.5, ridge = 0.01, lr = 0.05, iters = 3000, rhoMax = 0.2 } = opciones;

  // Universo de equipos: los que aparecen en partidos UNION los que tienen ancla FIFA
  // (asi entran tambien los anfitriones, que no jugaron eliminatorias).
  const ids = [...new Set([...matches.flatMap((m) => [m.homeId, m.awayId]), ...fifaZ.keys()])];
  const n = ids.length;
  const pos = new Map(ids.map((id, k) => [id, k]));

  // Arrays compactos de partidos.
  const M = matches.length;
  const hi = new Int32Array(M), ai = new Int32Array(M);
  const GH = new Float64Array(M), GA = new Float64Array(M), W = new Float64Array(M);
  let sumW = 0;
  for (let k = 0; k < M; k++) {
    hi[k] = pos.get(matches[k].homeId); ai[k] = pos.get(matches[k].awayId);
    GH[k] = matches[k].gh; GA[k] = matches[k].ga; W[k] = matches[k].weight ?? 1; sumW += W[k];
  }
  if (sumW <= 0) sumW = 1;

  // Objetivo del prior por equipo: r_t -> z_fifa·sigma (null si no hay FIFA).
  const target = ids.map((id) => (fifaZ.has(id) ? fifaZ.get(id) * sigma : null));

  // Parametros.
  const a = new Float64Array(n), d = new Float64Array(n);
  let base = 0, h = 0.2, rho = 0;

  const ga = new Float64Array(n), gd = new Float64Array(n);
  for (let it = 0; it < iters; it++) {
    ga.fill(0); gd.fill(0);
    let gBase = 0, gH = 0, gRho = 0;
    for (let k = 0; k < M; k++) {
      const i = hi[k], j = ai[k], w = W[k];
      const lh = Math.exp(base + h + a[i] + d[j]);
      const la = Math.exp(base + a[j] + d[i]);
      // Residual Poisson (x-λ) + correccion τ (dlogτ/dλ · λ).
      const { dlogTau_dlh, dlogTau_dla, dlogTau_drho } = tauDC(GH[k], GA[k], lh, la, rho);
      const Rh = (GH[k] - lh) + dlogTau_dlh * lh;
      const Ra = (GA[k] - la) + dlogTau_dla * la;
      gBase += w * (Rh + Ra);
      gH += w * Rh;
      ga[i] += w * Rh; gd[j] += w * Rh;   // local marca: ataque_i, defensa_j
      ga[j] += w * Ra; gd[i] += w * Ra;   // visita marca: ataque_j, defensa_i
      gRho += w * dlogTau_drho;
    }
    // Priors: ancla FIFA sobre r=a-d, y ridge L2 sobre a y d (estabilidad).
    for (let k = 0; k < n; k++) {
      if (target[k] !== null) {
        const rr = (a[k] - d[k]) - target[k];
        ga[k] -= eta * rr * sumW; gd[k] += eta * rr * sumW; // escalado a sumW (ver division abajo)
      }
      ga[k] -= ridge * a[k] * sumW;
      gd[k] -= ridge * d[k] * sumW;
    }
    // Actualizacion (paso normalizado por suma de pesos).
    base += lr * gBase / sumW; h += lr * gH / sumW; rho += lr * gRho / sumW;
    if (rho > rhoMax) rho = rhoMax; else if (rho < -rhoMax) rho = -rhoMax;
    for (let k = 0; k < n; k++) { a[k] += lr * ga[k] / sumW; d[k] += lr * gd[k] / sumW; }
    // Recentrado (identificabilidad): media(a)=0, media(d)=0.
    let ma = 0, md = 0;
    for (let k = 0; k < n; k++) { ma += a[k]; md += d[k]; }
    ma /= n; md /= n;
    for (let k = 0; k < n; k++) { a[k] -= ma; d[k] -= md; }
  }

  // Conteo de partidos por equipo y log-verosimilitud final (diagnostico).
  const nMatches = new Map(ids.map((id) => [id, 0]));
  for (let k = 0; k < M; k++) { nMatches.set(ids[hi[k]], nMatches.get(ids[hi[k]]) + 1); nMatches.set(ids[ai[k]], nMatches.get(ids[ai[k]]) + 1); }
  let ll = 0;
  for (let k = 0; k < M; k++) {
    const lh = Math.exp(base + h + a[hi[k]] + d[ai[k]]);
    const la = Math.exp(base + a[ai[k]] + d[hi[k]]);
    const { tau } = tauDC(GH[k], GA[k], lh, la, rho);
    ll += W[k] * (GH[k] * Math.log(lh) - lh + GA[k] * Math.log(la) - la + Math.log(tau));
  }

  return {
    base, h, rho,
    ataque: new Map(ids.map((id, k) => [id, a[k]])),
    defensa: new Map(ids.map((id, k) => [id, d[k]])),
    ids, nMatches, ll,
  };
}

// Goles esperados de un partido segun el ajuste. neutral=true => sin ventaja de
// local (sede neutral). hfaOverride permite forzar la ventaja (p.ej. anfitrion).
export function lambdasDC(fit, homeId, awayId, { neutral = true, hfa = null } = {}) {
  const a = fit.ataque, d = fit.defensa;
  const ai = a.get(homeId) ?? 0, di = d.get(homeId) ?? 0;
  const aj = a.get(awayId) ?? 0, dj = d.get(awayId) ?? 0;
  const ventaja = hfa !== null ? hfa : (neutral ? 0 : fit.h);
  const lambdaLocal = Math.exp(fit.base + ventaja + ai + dj);
  const lambdaVisita = Math.exp(fit.base + aj + di);
  return { lambdaLocal, lambdaVisita };
}
