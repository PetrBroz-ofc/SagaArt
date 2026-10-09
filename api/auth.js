const crypto = require('crypto');
const { promisify } = require('util');
const {
  getDb, sha256, safeEqual, noStore, clientIp, sleep, fail, guard, limitOrReject,
  setSessionCookie, clearSessionCookie, isAdmin,
} = require('./_utils');

const scrypt = promisify(crypto.scrypt);

// ── Heslo: ADMIN_PASSWORD_HASH = "scrypt$<salt hex>$<hash hex>" (vygeneruje scripts/hash-password.js) ──
async function checkPassword(password) {
  const [algo, saltHex, hashHex] = String(process.env.ADMIN_PASSWORD_HASH || '').split('$');
  if (algo !== 'scrypt' || !saltHex || !hashHex) throw new Error('ADMIN_PASSWORD_HASH není nastaven');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(String(password), Buffer.from(saltHex, 'hex'), expected.length,
    { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return crypto.timingSafeEqual(actual, expected);
}

// ── Dvoufázové ověření TOTP (RFC 6238) — kód z Google Authenticator / Authy ──
function base32Decode(s) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0;
  const out = [];
  for (const c of String(s).toUpperCase().replace(/[\s=]/g, '')) {
    const i = alphabet.indexOf(c);
    if (i < 0) throw new Error('Neplatný TOTP secret');
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

function totpAt(key, step) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac('sha1', key).update(buf).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1000000).padStart(6, '0');
}

// Vrací použitý časový krok, nebo null. Tolerance ±30 s.
function matchTotp(code) {
  const secret = process.env.ADMIN_TOTP_SECRET;
  if (!secret) throw new Error('ADMIN_TOTP_SECRET není nastaven');
  if (!/^\d{6}$/.test(String(code))) return null;
  const key = base32Decode(secret);
  const now = Math.floor(Date.now() / 30000);
  let found = null;
  for (const step of [now - 1, now, now + 1]) {
    if (safeEqual(totpAt(key, step), code)) found = step; // projde vždy všechny kroky (konstantní čas)
  }
  return found;
}

// Stejný kód nejde použít dvakrát (ochrana proti odposlechu / replay).
async function consumeTotpStep(step) {
  const db = getDb();
  const ref = db.collection('admin').doc('totp');
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const last = snap.exists ? Number(snap.data().lastStep) : -1;
    if (step <= last) return false;
    tx.set(ref, { lastStep: step, usedAt: new Date() });
    return true;
  });
}

export default async function handler(req, res) {
  noStore(res);
  if (!guard(req, res, ['GET', 'POST', 'DELETE'])) return;

  // Stav přihlášení (admin.html se ptá při načtení)
  if (req.method === 'GET') {
    return res.status(200).json({ authenticated: isAdmin(req) });
  }

  // Odhlášení
  if (req.method === 'DELETE') {
    clearSessionCookie(res);
    return res.status(200).json({ ok: true });
  }

  // Přihlášení — limit 5 pokusů / 15 min na IP a 20 / hod celkově (proti distribuovanému útoku)
  const ip = clientIp(req);
  if (!(await limitOrReject(res, 'login_ip', ip, 5, 15 * 60 * 1000))) return;
  if (!(await limitOrReject(res, 'login_all', 'global', 20, 60 * 60 * 1000))) return;

  const { password, totp } = req.body;
  if (typeof password !== 'string' || password.length > 200 || typeof totp !== 'string') {
    await sleep(400 + Math.random() * 400);
    return fail(res, 401, 'Neplatné přihlašovací údaje');
  }

  try {
    const passOk = await checkPassword(password);
    const step = matchTotp(totp.trim());
    if (!passOk || step === null || !(await consumeTotpStep(step))) {
      console.warn('Neúspěšné přihlášení do adminu', { ipHash: sha256(ip).slice(0, 12) });
      await sleep(400 + Math.random() * 400);
      return fail(res, 401, 'Neplatné přihlašovací údaje');
    }
    setSessionCookie(res);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('auth error:', e.message);
    return fail(res, 500, 'Server není správně nakonfigurován');
  }
}
