'use client';

import React, { useState } from 'react';
import { submitFeedback } from '@/lib/clipper';

// A small floating feedback affordance for the demo. The whole point of the
// MVP is to collect founder reactions, so this sits in the studio and posts to
// POST /v1/feedback. Themed to match the artifact (#53fc18 on stone).

const ACCENT = '#53fc18';

export default function FeedbackWidget({ jobId }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | done | error
  const [error, setError] = useState('');

  const canSend = rating > 0 || message.trim().length > 0;

  async function send() {
    if (!canSend || state === 'sending') return;
    setState('sending');
    setError('');
    try {
      await submitFeedback({ rating: rating || null, message, email, jobId });
      setState('done');
      setTimeout(() => {
        setOpen(false);
        // reset after the panel closes
        setTimeout(() => {
          setState('idle');
          setRating(0);
          setMessage('');
          setEmail('');
        }, 300);
      }, 1400);
    } catch (e) {
      setError(e?.message || 'Something went wrong');
      setState('error');
    }
  }

  return (
    <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 60 }} className="mono">
      {open && (
        <div
          style={{
            width: 320,
            marginBottom: 12,
            background: 'rgba(12,12,11,0.97)',
            border: '1px solid #292524',
            borderRadius: 16,
            padding: 18,
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {state === 'done' ? (
            <div style={{ textAlign: 'center', padding: '18px 6px' }}>
              <div style={{ color: ACCENT, fontSize: 13, letterSpacing: '0.04em' }}>
                ✓ Thank you — noted.
              </div>
            </div>
          ) : (
            <>
              <div
                style={{
                  fontSize: 11,
                  color: '#a8a29e',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  marginBottom: 12,
                }}
              >
                How was this?
              </div>

              {/* rating */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {[1, 2, 3, 4, 5].map((n) => {
                  const active = (hover || rating) >= n;
                  return (
                    <button
                      key={n}
                      onMouseEnter={() => setHover(n)}
                      onMouseLeave={() => setHover(0)}
                      onClick={() => setRating(n)}
                      aria-label={`${n} star${n > 1 ? 's' : ''}`}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        border: `1px solid ${active ? ACCENT : '#3f3f46'}`,
                        background: active ? 'rgba(83,252,24,0.12)' : 'transparent',
                        color: active ? ACCENT : '#71717a',
                        cursor: 'pointer',
                        fontSize: 14,
                        transition: 'all 0.12s',
                      }}
                    >
                      ★
                    </button>
                  );
                })}
              </div>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What worked? What didn't? Be brutal."
                rows={3}
                style={{
                  width: '100%',
                  background: '#0c0c0b',
                  border: '1px solid #292524',
                  borderRadius: 10,
                  color: '#e7e5e4',
                  fontSize: 13,
                  padding: 10,
                  resize: 'none',
                  outline: 'none',
                  marginBottom: 10,
                  fontFamily: 'inherit',
                }}
              />

              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email (optional)"
                style={{
                  width: '100%',
                  background: '#0c0c0b',
                  border: '1px solid #292524',
                  borderRadius: 10,
                  color: '#e7e5e4',
                  fontSize: 13,
                  padding: '9px 10px',
                  outline: 'none',
                  marginBottom: 12,
                  fontFamily: 'inherit',
                }}
              />

              {state === 'error' && (
                <div style={{ color: '#f87171', fontSize: 11, marginBottom: 8 }}>{error}</div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setOpen(false)}
                  style={{
                    flex: '0 0 auto',
                    padding: '9px 14px',
                    borderRadius: 10,
                    border: '1px solid #292524',
                    background: 'transparent',
                    color: '#a8a29e',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Later
                </button>
                <button
                  onClick={send}
                  disabled={!canSend || state === 'sending'}
                  style={{
                    flex: 1,
                    padding: '9px 14px',
                    borderRadius: 10,
                    border: 'none',
                    background: canSend ? ACCENT : '#3f3f46',
                    color: canSend ? '#0c0c0b' : '#71717a',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: canSend ? 'pointer' : 'not-allowed',
                    transition: 'all 0.12s',
                  }}
                >
                  {state === 'sending' ? 'Sending…' : 'Send feedback'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          padding: '11px 18px',
          borderRadius: 999,
          border: `1px solid ${ACCENT}`,
          background: open ? '#0c0c0b' : 'rgba(83,252,24,0.1)',
          color: ACCENT,
          fontSize: 12,
          letterSpacing: '0.04em',
          cursor: 'pointer',
          boxShadow: '0 6px 24px rgba(83,252,24,0.18)',
          float: 'right',
        }}
      >
        {open ? 'Close' : 'Feedback'}
      </button>
    </div>
  );
}
