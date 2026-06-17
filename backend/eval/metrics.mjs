/** Q1 — ranking-quality metrics for the clip-selection eval.
 *
 *  The pipeline returns clip candidates ranked by score; a fixture carries the
 *  human-labelled "good clip" spans. A candidate is RELEVANT if it overlaps a
 *  labelled span by at least MIN_OVERLAP_S seconds. From the ranked relevance
 *  bitmap we compute the standard ranking metrics, so a regression that pushes
 *  good clips down the list (or surfaces vacuous ones) shows up as a number.
 *
 *  Pure + deterministic — no I/O, unit-testable on its own.
 */
export const MIN_OVERLAP_S = 8;

const overlapS = (a, b) => Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0]));

/** Is candidate span relevant to ANY labelled good span? */
export function isRelevant(candidate, labels, minOverlap = MIN_OVERLAP_S) {
  return labels.some((l) => overlapS(candidate, l) >= minOverlap);
}

/** Map a ranked candidate list → a relevance bitmap (1 = hits a good span). */
export function relevanceBitmap(rankedSpans, labels, minOverlap = MIN_OVERLAP_S) {
  return rankedSpans.map((c) => (isRelevant(c, labels, minOverlap) ? 1 : 0));
}

export function precisionAtK(rel, k) {
  const top = rel.slice(0, k);
  return top.length ? top.reduce((a, b) => a + b, 0) / top.length : 0;
}

/** Recall@K against the number of distinct good spans actually covered. */
export function recallAtK(rankedSpans, labels, k, minOverlap = MIN_OVERLAP_S) {
  if (!labels.length) return 0;
  const covered = new Set();
  rankedSpans.slice(0, k).forEach((c) => {
    labels.forEach((l, i) => { if (overlapS(c, l) >= minOverlap) covered.add(i); });
  });
  return covered.size / labels.length;
}

/** nDCG@K with binary relevance (DCG normalised by the ideal ordering). */
export function ndcgAtK(rel, k) {
  const dcg = (xs) => xs.slice(0, k).reduce((a, r, i) => a + r / Math.log2(i + 2), 0);
  const ideal = [...rel].sort((a, b) => b - a);
  const idcg = dcg(ideal);
  return idcg ? dcg(rel) / idcg : 0;
}

/** Average Precision: mean of precision@i at each relevant rank. */
export function averagePrecision(rel) {
  const totalRel = rel.reduce((a, b) => a + b, 0);
  if (!totalRel) return 0;
  let hits = 0, sum = 0;
  rel.forEach((r, i) => { if (r) { hits += 1; sum += hits / (i + 1); } });
  return sum / totalRel;
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const round = (x) => Number(Number(x).toFixed(4));

/** Aggregate per-recording results into corpus metrics. `perRec` is an array of
 *  { rel, rankedSpans, labels }. K defaults to the label count of each recording
 *  (precision/recall measured against how many good clips that recording had). */
export function aggregate(perRec) {
  const ap = [], ndcg = [], prec = [], rec = [];
  for (const { rel, rankedSpans, labels } of perRec) {
    const k = Math.max(1, labels.length);
    ap.push(averagePrecision(rel));
    ndcg.push(ndcgAtK(rel, k));
    prec.push(precisionAtK(rel, k));
    rec.push(recallAtK(rankedSpans, labels, k));
  }
  return {
    map: round(mean(ap)),
    ndcg: round(mean(ndcg)),
    precisionAtK: round(mean(prec)),
    recallAtK: round(mean(rec)),
    recordings: perRec.length,
  };
}

/** Did `current` regress past `baseline` on any gated metric, beyond tolerance? */
export function regressed(current, baseline, tolerance) {
  const keys = ['map', 'ndcg', 'precisionAtK', 'recallAtK'];
  return keys.filter((k) => current[k] < (baseline[k] ?? 0) - tolerance);
}
