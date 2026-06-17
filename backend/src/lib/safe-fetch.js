/** SSRF-safe fetch for user-supplied ingest URLs (Excellence S1).
 *
 *  A client submits a `source_url`; the pipeline fetches it server-side. Left
 *  open that is a textbook SSRF: a URL could point at cloud metadata
 *  (169.254.169.254), internal services (10.x / 192.168.x / localhost), or a
 *  non-HTTP scheme (file://). This guard:
 *
 *   - allows only https (and http only if INGEST_ALLOW_HTTP=true);
 *   - resolves the host and refuses private / loopback / link-local / reserved
 *     IPs (v4 and v6) — including the link-local metadata range;
 *   - re-validates EVERY redirect hop (an open redirect can't smuggle you onto
 *     a private IP);
 *   - pins the connection to the validated IP via the request `lookup` option,
 *     so DNS can't rebind to a private address between check and connect;
 *   - caps response size (Content-Length) and wall-clock time.
 *
 *  INGEST_HOST_ALLOWLIST (comma-separated hosts), when set, restricts fetches to
 *  exactly those hosts and trusts them (skips the IP-range check) — for
 *  locked-down deployments, or to point a test at a local fixture server.
 *
 *  Zero-dep: node:http/https honour a custom `lookup`, so no undici/agent
 *  dependency is needed to pin the IP.
 */
import dns from 'node:dns/promises';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';

export class SsrfError extends Error {
  constructor(message) { super(message); this.name = 'SsrfError'; }
}

const MAX_REDIRECTS = Number(process.env.INGEST_MAX_REDIRECTS || 5);
const TIMEOUT_MS = Number(process.env.INGEST_FETCH_TIMEOUT_MS || 20000);

const allowHttp = () => process.env.INGEST_ALLOW_HTTP === 'true';
const hostAllowlist = () => (process.env.INGEST_HOST_ALLOWLIST || '')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

/** True only for globally-routable addresses. Anything private, loopback,
 *  link-local, CGNAT, multicast, or reserved is rejected. */
export function isPublicIp(ip) {
  if (net.isIPv4(ip)) return isPublicIPv4(ip);
  if (net.isIPv6(ip)) return isPublicIPv6(ip.toLowerCase());
  return false;
}

function isPublicIPv4(ip) {
  const o = ip.split('.').map(Number);
  if (o.length !== 4 || o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b, c] = o;
  if (a === 0) return false;                          // 0.0.0.0/8 "this host"
  if (a === 10) return false;                         // 10.0.0.0/8 private
  if (a === 127) return false;                        // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return false;           // 169.254.0.0/16 link-local (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return false;  // 172.16.0.0/12 private
  if (a === 192 && b === 168) return false;           // 192.168.0.0/16 private
  if (a === 192 && b === 0 && c === 0) return false;  // 192.0.0.0/24 IETF protocol
  if (a === 192 && b === 0 && c === 2) return false;  // 192.0.2.0/24 TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return false; // 198.18.0.0/15 benchmarking
  if (a === 198 && b === 51 && c === 100) return false;  // 198.51.100.0/24 TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return false;   // 203.0.113.0/24 TEST-NET-3
  if (a === 100 && b >= 64 && b <= 127) return false; // 100.64.0.0/10 CGNAT
  if (a >= 224) return false;                         // 224/4 multicast + 240/4 reserved + 255.255.255.255
  return true;
}

function isPublicIPv6(ip) {
  if (ip === '::1' || ip === '::') return false;      // loopback / unspecified
  const mapped = ip.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/); // IPv4-mapped
  if (mapped) return isPublicIPv4(mapped[1]);
  if (/^f[cd]/.test(ip)) return false;                // fc00::/7 unique-local
  if (/^fe[89ab]/.test(ip)) return false;             // fe80::/10 link-local
  if (/^ff/.test(ip)) return false;                   // ff00::/8 multicast
  return true;
}

async function resolveAll(host) {
  try {
    return await dns.lookup(host, { all: true });     // IP literals pass through without a query
  } catch (e) {
    throw new SsrfError(`could not resolve host ${host}: ${e.message}`);
  }
}

/** Validate scheme + host policy and resolve the IP we will actually connect to.
 *  Throws SsrfError on anything not allowed. Returns the URL + the pinned IP. */
export async function assertSafeUrl(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch { throw new SsrfError(`invalid URL: ${rawUrl}`); }

  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && allowHttp())) {
    throw new SsrfError(`scheme not allowed: ${u.protocol} (only https; set INGEST_ALLOW_HTTP=true for http)`);
  }

  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, ''); // strip [ ] off IPv6 literals
  const allow = hostAllowlist();
  if (allow.length) {
    if (!allow.includes(host)) throw new SsrfError(`host not in INGEST_HOST_ALLOWLIST: ${host}`);
    const [first] = await resolveAll(host);           // trusted host: pin an IP, skip the range check
    return { url: u, host, ip: first.address, family: first.family };
  }

  const addrs = await resolveAll(host);
  for (const a of addrs) {
    if (!isPublicIp(a.address)) {
      throw new SsrfError(`refusing to fetch private/reserved address ${a.address} for host ${host}`);
    }
  }
  return { url: u, host, ip: addrs[0].address, family: addrs[0].family };
}

function requestOnce(url, ip, family, timeoutMs) {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    const fam = family || (net.isIPv6(ip) ? 6 : 4);
    const req = lib.request(url, {
      method: 'GET',
      // Pin the connection to the IP we validated. The host header / TLS SNI
      // still use url.hostname, so certs verify and DNS can't rebind on us.
      // Node calls lookup with { all: true }, which wants the array form.
      lookup: (_hostname, opts, cb) =>
        (opts && opts.all ? cb(null, [{ address: ip, family: fam }]) : cb(null, ip, fam)),
      headers: { 'user-agent': 'clipper-ingest/1.0', accept: '*/*' },
    }, resolve);
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new SsrfError(`fetch timed out after ${timeoutMs}ms`)));
    req.end();
  });
}

/** SSRF-guarded GET. Follows redirects (re-validating each hop), returns
 *  { status, headers, body } where body is a Node Readable stream. Throws
 *  SsrfError on policy violations, non-2xx, oversize, timeout, or redirect loop. */
export async function safeFetch(rawUrl, { maxBytes = Number(process.env.MAX_UPLOAD_BYTES || 0), timeoutMs = TIMEOUT_MS } = {}) {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const { url, ip, family } = await assertSafeUrl(current);
    const res = await requestOnce(url, ip, family, timeoutMs);

    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      res.resume();                                    // drain so the socket frees
      current = new URL(res.headers.location, url).href;
      continue;
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      res.resume();
      throw new SsrfError(`source fetch failed (${res.statusCode})`);
    }
    const len = Number(res.headers['content-length'] || 0);
    if (maxBytes && len && len > maxBytes) {
      res.destroy();
      throw new SsrfError(`source too large (${len} > ${maxBytes} bytes)`);
    }
    return { status: res.statusCode, headers: res.headers, body: res };
  }
  throw new SsrfError(`too many redirects (> ${MAX_REDIRECTS})`);
}
