// Jednorázově nahraje výchozí šperky (public/data/products.json) do Firestore.
// Existující šperky NEPŘEPISUJE. Potřebuje .env.local s FIREBASE_* proměnnými.
// Použití: npm run seed
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\n/g, '\n'),
  }),
});
const db = getFirestore();
const products = require(path.join(__dirname, '..', 'public', 'data', 'products.json'));

(async () => {
  let created = 0, skipped = 0;
  for (const { id, ...p } of products) {
    try {
      await db.collection('products').doc(id).create({ ...p, price: Math.round(p.price), inStock: true });
      created++;
    } catch (e) {
      if (e.code === 6) { skipped++; continue; } // už existuje
      throw e;
    }
  }
  console.log(`Hotovo: přidáno ${created}, přeskočeno (už existují) ${skipped}.`);
})().catch(e => { console.error(e.message); process.exit(1); });
