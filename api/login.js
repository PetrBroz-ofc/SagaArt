const crypto = require('crypto');
const { applyCors, signAdminToken } = require('./_utils');

// Best-effort rate limit per IP (drží se po dobu života lambda instance).
// Pro tvrdý limit napříč instancemi použij Vercel Firewall nebo Upstash Ratelimit.
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function tooManyAttempts(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now - rec.first > WINDOW_MS) return false;
  return rec.count >= MAX_ATTEMPTS;
}

function recordFailure(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now - rec.first > WINDOW_MS) {
    attempts.set(ip, { first: now, count: 1 });
  } else {
    rec.count++;
  }
  // úklid starých záznamů
  if (attempts.size > 1000) {
    for (const [k, v] of attempts) {
      if (now - v.first > WINDOW_MS) attempts.delete(k);
    }
  }
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return res.status(405).end();

  if (!process.env.ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'Server není nakonfigurován' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket?.remoteAddress || 'unknown';

  if (tooManyAttempts(ip)) {
    return res.status(429).json({ error: 'Příliš mnoho pokusů. Zkuste to za 15 minut.' });
  }

  const password = req.body?.password;
  if (typeof password !== 'string' || !safeEqual(password, process.env.ADMIN_PASSWORD)) {
    recordFailure(ip);
    // malé zpoždění proti hrubé síle
    await new Promise(r => setTimeout(r, 500));
    return res.status(401).json({ error: 'Špatné heslo' });
  }

  attempts.delete(ip);
  res.status(200).json({ token: signAdminToken(), expiresInHours: 12 });
}
