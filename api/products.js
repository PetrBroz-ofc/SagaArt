const { getDb, applyCors, verifyAdmin } = require('./_utils');

const CATEGORIES = ['nahrdelniky', 'nausnice', 'naramky', 'soupravy'];
const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

// Whitelist polí + validace — do Firestore se nikdy neuloží nic navíc.
function sanitizeProduct(body) {
  if (!body || typeof body !== 'object') return { error: 'Chybí data' };

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 200) return { error: 'Neplatný název' };

  const price = Number(body.price);
  if (!Number.isFinite(price) || price <= 0 || price > 1000000) {
    return { error: 'Neplatná cena' };
  }

  const cat = CATEGORIES.includes(body.cat) ? body.cat : null;
  if (!cat) return { error: 'Neplatná kategorie' };

  const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

  const imgs = (Array.isArray(body.imgs) ? body.imgs : [])
    .map(u => str(u, 500))
    .filter(Boolean)
    .slice(0, 10);
  if (imgs.some(u => !/^https:\/\//.test(u))) return { error: 'Obrázky musí být https URL' };

  return {
    data: {
      name,
      price: Math.round(price),
      cat,
      collection: str(body.collection, 60),
      material: str(body.material, 300),
      desc: str(body.desc, 3000),
      imgs,
      badge: str(body.badge, 50),
      inStock: body.inStock !== false,
    },
  };
}

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, PUT, DELETE, OPTIONS')) return;

  if (!verifyAdmin(req)) {
    return res.status(401).json({ error: 'Neautorizováno' });
  }

  const db = getDb();

  try {
    if (req.method === 'GET') {
      const snap = await db.collection('products').orderBy('name').get();
      const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return res.status(200).json(products);
    }

    if (req.method === 'POST') {
      const { data, error } = sanitizeProduct(req.body);
      if (error) return res.status(400).json({ error });
      data.createdAt = new Date().toISOString();
      const ref = await db.collection('products').add(data);
      return res.status(200).json({ id: ref.id });
    }

    if (req.method === 'PUT') {
      const id = req.body?.id;
      if (typeof id !== 'string' || !ID_RE.test(id)) {
        return res.status(400).json({ error: 'Neplatné ID' });
      }
      const { data, error } = sanitizeProduct(req.body);
      if (error) return res.status(400).json({ error });
      data.updatedAt = new Date().toISOString();
      await db.collection('products').doc(id).update(data);
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const id = req.body?.id;
      if (typeof id !== 'string' || !ID_RE.test(id)) {
        return res.status(400).json({ error: 'Neplatné ID' });
      }
      await db.collection('products').doc(id).delete();
      return res.status(200).json({ ok: true });
    }

    return res.status(405).end();

  } catch (err) {
    console.error('products error:', err);
    res.status(500).json({ error: 'Interní chyba serveru' });
  }
}
