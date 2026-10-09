const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const jwt = require('jsonwebtoken');

const SITE_URL = process.env.SITE_URL || 'https://sagaart.cz';

const ALLOWED_ORIGINS = [
  SITE_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

function getDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  return getFirestore();
}

// CORS omezené na vlastní doménu. Same-origin requesty CORS nepotřebují,
// hlavičky se posílají jen povoleným originům.
// Vrací true, pokud šlo o OPTIONS preflight (handler má skončit).
function applyCors(req, res, methods) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

function jwtSecret() {
  const secret = process.env.ADMIN_JWT_SECRET || process.env.ADMIN_TOKEN;
  if (!secret) throw new Error('ADMIN_JWT_SECRET is not configured');
  return secret;
}

function signAdminToken() {
  return jwt.sign({ role: 'admin' }, jwtSecret(), { expiresIn: '12h' });
}

// Ověří Bearer JWT z Authorization hlavičky; vrací true/false.
function verifyAdmin(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return false;
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, jwtSecret());
    return payload.role === 'admin';
  } catch {
    return false;
  }
}

module.exports = { getDb, applyCors, signAdminToken, verifyAdmin, SITE_URL };
