/**
 * Commit-message gate (Capstone D2).
 *
 * This repo carries TWO valid header styles and both must pass:
 *   1. Conventional Commits — `feat: …`, `fix(scope): …`, `chore!: …` — these
 *      drive the changelog + semver bump (see `.versionrc.json`).
 *   2. Program codes — `D2: …`, `C5: …`, `U2.2: …` — the milestone scheme the
 *      MVP / Excellence / Capstone plans commit under (and the message this very
 *      commit uses). These are release-neutral but kept first-class so the gate
 *      never rejects the program's own history.
 *
 * Rather than enumerate ~60 program codes in `type-enum` (and fight
 * config-conventional's lower-case requirement), a single custom `header-format`
 * rule validates the header against both shapes. Structural rules below still
 * apply (length, non-empty subject, no trailing period).
 */
const CONVENTIONAL_TYPES = '(?:build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)';
// A program code: an upper-case track letter + number, optional `.sub` (e.g. U2.2).
const PROGRAM_CODE = '[A-Z]\\d+(?:\\.\\d+)?';
const HEADER = new RegExp(
  `^(?:${CONVENTIONAL_TYPES}(?:\\([\\w.\\-/ ]+\\))?!?|${PROGRAM_CODE}): .+`,
);

module.exports = {
  // Parse `type(scope): subject` so the built-in rules below get clean fields;
  // program codes flow through as the `type`.
  parserPreset: {
    parserOpts: {
      headerPattern: /^([\w.]+)(?:\(([^)]+)\))?!?: (.+)$/,
      headerCorrespondence: ['type', 'scope', 'subject'],
    },
  },
  plugins: [
    {
      rules: {
        'header-format': ({ header }) => [
          HEADER.test(header),
          'header must be "<type>: <subject>" — a Conventional type ' +
            '(feat, fix, chore, docs, …) or a program code (e.g. D2, C5, U2.2)',
        ],
      },
    },
  ],
  rules: {
    'header-format': [2, 'always'],
    'header-max-length': [2, 'always', 100],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'body-leading-blank': [2, 'always'],
    'footer-leading-blank': [1, 'always'],
  },
};
