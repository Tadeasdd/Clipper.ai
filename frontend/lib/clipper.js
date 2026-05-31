// lib/clipper.js — the demo's API client.
//
// No Clerk, no auth header: the backend runs in DEMO_MODE, which resolves every
// request to the shared demo org regardless of Authorization. That's what lets
// us drop founders straight into the studio with no sign-in wall.
//
// Talks to the FastAPI backend at NEXT_PUBLIC_API_URL (default localhost:8000).

const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Allowed by the backend's PresignRequest. Map a few common types; default mp4.
const CONTENT_TYPES = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
};

function contentTypeFor(file) {
  if (file.type && Object.values(CONTENT_TYPES).includes(file.type)) return file.type;
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  return CONTENT_TYPES[ext] || 'video/mp4';
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      // Backend uses an { error: { message } } envelope; tolerate other shapes.
      msg = body?.error?.message || body?.detail || body?.message || msg;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

// ──────────────────────────────────────────────────────────── endpoints

export async function presignUpload(file) {
  return apiFetch('/v1/uploads/presign', {
    method: 'POST',
    body: JSON.stringify({
      filename: file.name,
      content_type: contentTypeFor(file),
      size_bytes: file.size,
    }),
  });
}

// Direct PUT to R2 with upload progress (fetch can't report upload progress,
// so we use XHR).
export function putToR2(url, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentTypeFor(file));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress((e.loaded / e.total) * 100);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`R2 upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error('R2 upload network error'));
    xhr.send(file);
  });
}

export async function createJob({ source_filename, source_r2_key, source_size_bytes }) {
  const idempotencyKey =
    (typeof crypto !== 'undefined' && crypto.randomUUID && crypto.randomUUID()) ||
    `${Date.now()}-${Math.random()}`;
  return apiFetch('/v1/jobs', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ source_filename, source_r2_key, source_size_bytes }),
  });
}

export async function getJob(id) {
  return apiFetch(`/v1/jobs/${id}`);
}

export async function listJobs(limit = 50) {
  return apiFetch(`/v1/jobs?limit=${limit}`);
}

export async function submitFeedback({ rating, message, email, jobId } = {}) {
  return apiFetch('/v1/feedback', {
    method: 'POST',
    body: JSON.stringify({
      rating: rating ?? null,
      message: message || null,
      email: email || null,
      job_id: jobId || null,
      context: typeof window !== 'undefined' ? { path: window.location?.pathname } : null,
    }),
  });
}

// ──────────────────────────────────────────────────────────── mapping

function fmtTime(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

// Backend ClipResponse → the shape the results/detail views consume.
export function mapClip(c, i = 0) {
  return {
    id: c.id,
    title: c.title,
    hook: c.hook,
    duration: Math.round(c.duration_seconds || 0),
    virality: c.virality_score ?? 0,
    timestamp: `${fmtTime(c.start_seconds)} - ${fmtTime(c.end_seconds)}`,
    platforms: c.platforms && c.platforms.length ? c.platforms : ['TikTok', 'Reels', 'Shorts'],
    reasons: c.reasons || [],
    engagement: c.engagement || { hook: 0, retention: 0, shareability: 0 },
    thumbnail: `gradient-${(i % 6) + 1}`,
    rendered_urls: c.rendered_urls || null, // presigned download URLs by aspect
  };
}

// ──────────────────────────────────────────────────────────── orchestration

// Map backend job status → index into the studio's analysisSteps array.
const STATUS_STEP = {
  queued: 0,
  transcribing: 0,
  segmenting: 2,
  scoring: 3,
  rendering: 4,
  complete: 5,
};
const TERMINAL = new Set(['complete', 'failed', 'cancelled']);

// Run the full real pipeline for one uploaded file, reporting progress as it
// goes. Resolves with { clips, jobId }; throws on failure/cancellation.
export async function runDemoPipeline(file, { onProgress } = {}) {
  const report = (pct, step) => onProgress && onProgress(Math.min(100, Math.round(pct)), step);

  report(2, 0);
  const { upload_url, r2_key } = await presignUpload(file);

  // Upload occupies the first 10% of the bar; the pipeline owns the rest.
  await putToR2(upload_url, file, (uploadPct) => report(uploadPct * 0.1, 0));
  report(10, 0);

  const job = await createJob({
    source_filename: file.name,
    source_r2_key: r2_key,
    source_size_bytes: file.size,
  });

  let current = job;
  while (!TERMINAL.has(current.status)) {
    await sleep(2000);
    current = await getJob(job.id);
    report(Math.max(10, current.progress_pct || 10), STATUS_STEP[current.status] ?? 0);
  }

  if (current.status !== 'complete') {
    throw new Error(current.error_message || `Job ${current.status}`);
  }

  report(100, 5);
  return { clips: (current.clips || []).map(mapClip), jobId: job.id };
}

// Load the seeded showcase (+ any live runs) for the studio sidebar/history.
export async function fetchShowcase() {
  const data = await listJobs(50);
  const jobs = (data?.items || []).filter((j) => j.status === 'complete' && (j.clips || []).length);
  return jobs.map((j) => ({
    id: j.id,
    videoMeta: { name: j.source_filename, size: '' },
    clips: (j.clips || []).map(mapClip),
    createdAt: j.created_at,
  }));
}
