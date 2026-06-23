/** D3 contract — the API's response shapes, declared once.
 *
 *  Reuses the request validator (`checkBody`, src/lib/validate.js) as a
 *  response-shape asserter (DRY): it returns [] when an object satisfies the
 *  declared required fields + types, and a list of violations otherwise. A
 *  removed / renamed / retyped response field therefore fails the gate.
 */
import { checkBody } from '../../src/lib/validate.js';

/** Returns [] when `obj` conforms to `schema`, else the list of violations. */
export function shapeErrors(obj, schema) {
  return checkBody(obj, schema, { strict: false });
}

export const CONTRACTS = {
  health: {
    ok: { type: 'boolean', required: true },
    service: { type: 'string', required: true },
    db: { type: 'string', required: true, enum: ['up', 'down'] },
  },
  error: {
    error: { type: 'string', required: true },
  },
  client: {
    id: {
      type: 'string',
      required: true,
      test: (v) => v.startsWith('cli_'),
      message: 'client id must carry the cli_ prefix',
    },
    name: { type: 'string', required: true },
  },
  lead: {
    id: { type: 'string', required: true },
    position: { type: 'number', required: true, min: 1 },
    duplicate: { type: 'boolean', required: true },
  },
  leadStats: {
    total: { type: 'number', required: true },
    today: { type: 'number', required: true },
  },
  recording: {
    recordingId: { type: 'string', required: true },
    status: { type: 'string', required: true },
  },
  uploadTarget: {
    mode: { type: 'string', required: true },
    uploadUrl: { type: 'string', required: true },
  },
};
