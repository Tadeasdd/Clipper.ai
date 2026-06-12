/** Stage B6.3 — rank statistics, pure functions (smoke-tested directly).
 *  Spearman over Pearson on purpose: performance numbers are heterogeneous
 *  across platforms and audiences, and ranks are scale-free — "did higher-
 *  scored clips do better" is an ordering question. */

/** Ranks with ties averaged (the standard treatment). */
export function ranks(xs) {
  const order = xs.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const out = new Array(xs.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    const avg = (i + j) / 2 + 1; // 1-based average rank across the tie run
    for (let k = i; k <= j; k++) out[order[k][1]] = avg;
    i = j + 1;
  }
  return out;
}

/** Spearman's ρ = Pearson over the ranks. Returns null when undefined
 *  (n < 2 or a constant series — no ordering to correlate). */
export function spearman(xs, ys) {
  if (xs.length !== ys.length || xs.length < 2) return null;
  const rx = ranks(xs), ry = ranks(ys);
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const mx = mean(rx), my = mean(ry);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < rx.length; i++) {
    const a = rx[i] - mx, b = ry[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}
