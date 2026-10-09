const { getDb } = require('./_utils');

export default async function handler(req, res) {
  // Veřejná data jen pro čtení — otevřený origin je zde v pořádku.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60'); // cache 60s

  if (req.method !== 'GET') return res.status(405).end();

  try {
    const db = getDb();
    const snap = await db.collection('products').get();
    const products = snap.docs
      .map(d => {
        const p = d.data();
        // jen pole, která frontend potřebuje — nic navíc neunikne
        return {
          id: d.id,
          name: p.name,
          price: p.price,
          cat: p.cat,
          collection: p.collection || '',
          material: p.material || '',
          desc: p.desc || '',
          imgs: Array.isArray(p.imgs) ? p.imgs : (p.img ? [p.img] : []),
          badge: p.badge || '',
          inStock: p.inStock !== false,
          createdAt: p.createdAt || '',
        };
      })
      .filter(p => p.inStock)
      // nejnovější první, jako na Fleru
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.status(200).json(products);
  } catch (err) {
    console.error('products-public error:', err);
    res.status(500).json({ error: 'Interní chyba serveru' });
  }
}
