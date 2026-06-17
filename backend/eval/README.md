# Clip-quality eval (Q1)

The moat is the quality of the clips. This harness makes that quality a
measured, gated number instead of a vibe: it runs the **real `analyze`+`score`
pipeline** over a labelled corpus and scores how well it ranks the human-marked
"good clip" spans.

```bash
cd backend
npm run eval                 # measure + fail (exit 1) on a regression vs baseline
npm run eval -- --prove-gate # show a loudness-only ranking would fail the gate
npm run eval -- --update     # accept the current run as the new baseline (on merge)
```

## What it measures

`dataset.mjs` is the corpus — synthetic recordings whose content-rich spans are
deliberately **quieter** than loud, vacuous filler, so loudness alone mis-ranks
them and only a semantics-aware pipeline scores well. For each fixture the runner
synthesizes the audio (ffmpeg), injects the transcript, runs `analyze`+`score`
on an **isolated `clipper_eval` database** (default weights, deterministic), and
compares the ranked candidates to the labels:

- **Precision@K / Recall@K** — did the top candidates hit the good spans?
- **nDCG** — are the good clips ranked high, not just present?
- **MAP** — mean average precision across the corpus.
- **per-signal contribution** — weight × mean signal value over the good clips,
  so you can see *which* signals are carrying the ranking when quality moves.

`metrics.mjs` holds the (pure, deterministic) metric functions; `baseline.json`
is the committed bar. A change drops below `baseline − tolerance` → CI fails.

## Offline & deterministic

Builtin heuristic semantic pass + ffmpeg loudness + default weights → the same
numbers every run, zero external keys. With `LLM_PROVIDER=anthropic` the same
harness scores a real prompt's output (Q2 versions the prompt; this gate catches
a prompt/model change that regresses ranking).

## Note on saturation

The corpus is intentionally clean — semantics *clearly* should win — so the
baseline sits near 1.0 and the gate reliably catches the regression that matters
most (the semantic pass degrading toward loudness-only, which `--prove-gate`
demonstrates drops MAP to ~0.5 / nDCG to ~0.08). Q3 will fold real editor
decisions into this corpus, adding the harder, ambiguous cases that desaturate
the metric for finer-grained regressions.
