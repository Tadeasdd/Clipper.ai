/** Q1 — the golden eval corpus.
 *
 *  Synthetic but honest fixtures: each recording is pink noise whose loudness is
 *  automated per segment, plus an injected transcript so the real semantic pass
 *  runs offline (heuristic). The "good" segments are content-rich (controversy /
 *  education / story / emotion / hook) but deliberately QUIETER than the loud,
 *  vacuous filler — so a loudness-only ranker mis-orders them and only a
 *  semantics-aware pipeline scores well. Labels are the good spans.
 *
 *  To extend the corpus, add a recording here and refresh the baseline
 *  (`npm run eval -- --update`). Keep good spans ≥ ~16 s so they survive the
 *  clip-bounds snapping in analyze.
 */
const FILLER = 'um yeah so uh okay you know like i mean basically uh yeah it was uh kind of you know '
  + 'whatever um so anyway uh yeah okay so um right yeah you know uh and then uh yeah.';

export const DATASET = [
  {
    id: 'controversy-beats-volume',
    durationS: 120,
    baseGain: 0.03,
    segments: [
      { span: [12, 34], gain: 0.36, good: true,
        text: 'Here is the truth nobody admits. Actually the research data proves this is wrong. '
          + 'The reason it works is a controversial principle most people never understand, and that is why the study shocked everyone.' },
      { span: [70, 96], gain: 0.9, good: false, text: FILLER },
    ],
  },
  {
    id: 'educational-explainer',
    durationS: 130,
    baseGain: 0.04,
    segments: [
      { span: [50, 52], gain: 0.92, good: false, text: 'whoa' }, // a loud blip, no substance
      { span: [60, 84], gain: 0.30, good: true,
        text: 'Let me explain why this matters. The research shows a clear method, because the system works '
          + 'on one key principle. The evidence and the data are important, and once you understand the reason it all makes sense.' },
      { span: [100, 124], gain: 0.85, good: false, text: FILLER },
    ],
  },
  {
    id: 'story-arc',
    durationS: 120,
    baseGain: 0.03,
    segments: [
      { span: [15, 40], gain: 0.34, good: true,
        text: 'I remember when it first happened. Years ago I realized something, and then suddenly everything began to change. '
          + 'Finally the story made sense, and that moment told me everything.' },
      { span: [80, 104], gain: 0.88, good: false, text: FILLER },
    ],
  },
  {
    id: 'two-strong-moments',
    durationS: 160,
    baseGain: 0.03,
    segments: [
      { span: [14, 38], gain: 0.33, good: true,
        text: 'This is amazing and honestly unbelievable. I was shocked, it was incredible, and the crazy part is what happened next, '
          + 'because the data proves the reason everybody was wrong.' },
      { span: [70, 92], gain: 0.9, good: false, text: FILLER },
      { span: [110, 134], gain: 0.35, good: true,
        text: 'Why does nobody talk about this? Here is the one secret the research proves: actually the method works, '
          + 'and the evidence explains exactly why most people never understand the principle.' },
    ],
  },
  {
    id: 'hook-opener',
    durationS: 110,
    baseGain: 0.04,
    segments: [
      { span: [10, 12], gain: 0.95, good: false, text: 'haha' }, // loud laugh, no substance
      { span: [40, 64], gain: 0.32, good: true,
        text: 'Why do nobody understand this? Here is the truth: the research data proves the controversial reason it works, '
          + 'and that is the key principle nobody will explain to you.' },
      { span: [85, 105], gain: 0.86, good: false, text: FILLER },
    ],
  },
];

/** Labelled good spans for a fixture. */
export const labelsFor = (rec) => rec.segments.filter((s) => s.good).map((s) => s.span);
