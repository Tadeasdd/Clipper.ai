import { randomBytes } from 'node:crypto';
/** Prefixed ids (cli_…, rec_…, lead_…) — sortable enough, debuggable always. */
export const id = (prefix) => `${prefix}_${randomBytes(9).toString('base64url')}`;
