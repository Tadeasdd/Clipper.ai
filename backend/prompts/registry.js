/** Q2 — versioned prompt registry.
 *
 *  The LLM prompts that drive the product's semantic IP used to live as string
 *  literals inside llm.js — so nothing recorded WHICH prompt produced a result,
 *  and a prompt change couldn't be A/B'd or reproduced. Here each prompt is a
 *  named, versioned template: a static `instruction` (whose sha256 is the
 *  version's stable identity) plus a `render(args)` that interpolates the
 *  dynamic transcript content. Pick the active version with LLM_PROMPT_VERSION
 *  (default v1); every AI artifact is stamped with { promptId, promptVersion,
 *  promptHash } so runs are reproducible and comparable.
 */
import { createHash } from 'node:crypto';

const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

// ── prompt families, each with one or more versions ─────────────────────────
const PROMPTS = {
  'semantic-signals': {
    v1: {
      instruction:
        'For each numbered transcript span, rate these properties from 0.0 to 1.0: '
        + 'retention (how much it makes a viewer keep watching), emotion, controversy, education, '
        + 'story (storytelling), hookStrength (how well the FIRST line stops a scroll). Also give a '
        + 'one-line rationale (max 12 words). Respond ONLY with a JSON array, one object per span, '
        + 'keys: retention, emotion, controversy, education, story, hookStrength, rationale. No prose, no code fences.',
      render(instruction, spans) {
        return `${instruction}\n\n${spans.map((s, i) => `[${i + 1}] ${s.text}`).join('\n\n')}`;
      },
    },
    // v2: a refined instruction — sharper definitions + an explicit short-form
    //     lens. Identical output shape, so it's a drop-in A/B against v1.
    v2: {
      instruction:
        'You are grading transcript spans as candidate SHORT-FORM clips. For each numbered span, '
        + 'rate 0.0–1.0: retention (keeps a viewer watching to the end), emotion (felt intensity), '
        + 'controversy (a stance people would argue with), education (a concrete insight learned), '
        + 'story (a narrative beat with tension), hookStrength (does the FIRST sentence stop a scroll). '
        + 'Be decisive — reserve >0.7 for spans that clearly exemplify the property. Add a one-line '
        + 'rationale (max 12 words). Respond ONLY with a JSON array, one object per span, keys: '
        + 'retention, emotion, controversy, education, story, hookStrength, rationale. No prose, no code fences.',
      render(instruction, spans) {
        return `${instruction}\n\n${spans.map((s, i) => `[${i + 1}] ${s.text}`).join('\n\n')}`;
      },
    },
  },

  'nominate-spans': {
    v1: {
      instruction:
        'Below are transcript sentences with indices and start times. Pick up to {limit} contiguous '
        + 'ranges that would make the strongest short-form clips (controversy, emotion, education, story, '
        + 'or a strong hook). Respond ONLY with a JSON array of objects {from, to} where from/to are '
        + 'sentence indices (inclusive). No prose, no code fences.',
      render(instruction, { joined, limit }) {
        return `${instruction.replace('{limit}', String(limit))}\n\n${joined}`;
      },
    },
  },

  'hook-variants': {
    v1: {
      instruction:
        'Write {count} short-form hook lines for this clip — each MAX 9 words, no quotes, no hashtags, '
        + 'each making a viewer stop scrolling. Respond ONLY with a JSON array of strings. No prose, no code fences.',
      render(instruction, { text, count }) {
        return `${instruction.replace('{count}', String(count))}\n\n${text}`;
      },
    },
  },
};

// precompute version hashes once
for (const fam of Object.values(PROMPTS)) {
  for (const [ver, def] of Object.entries(fam)) def.hash = sha(`${ver}:${def.instruction}`);
}

/** The active prompt version (global selector; A/B sets this per run). */
export const activeVersion = () => process.env.LLM_PROMPT_VERSION || 'v1';

/** Resolve a prompt to { id, version, hash, build(args) }. Falls back to v1 if
 *  the requested version doesn't exist for this family (so a global version
 *  selector is safe even when a family has only v1). */
export function getPrompt(id, version = activeVersion()) {
  const fam = PROMPTS[id];
  if (!fam) throw new Error(`unknown prompt: ${id}`);
  const ver = fam[version] ? version : 'v1';
  const def = fam[ver];
  return { id, version: ver, hash: def.hash, build: (args) => def.render(def.instruction, args) };
}

/** Stamp-able metadata for a prompt version (no dynamic content). */
export function promptMeta(id, version = activeVersion()) {
  const p = getPrompt(id, version);
  return { promptId: p.id, promptVersion: p.version, promptHash: p.hash };
}
