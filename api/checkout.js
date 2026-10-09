const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getDb, applyCors, SITE_URL } = require('./_utils');

// Ceník dopravy — počítá se VŽDY na serveru, klient posílá jen typ.
const SHIPPING = {
  zasilkovna: { label: 'Doprava — Zásilkovna / Z-BOX',        price: 109 },
  balikovna:  { label: 'Doprava — Balíkovna',                 price: 109 },
  posta:      { label: 'Doprava — Česká pošta na adresu',     price: 130 },
  packeta_sk: { label: 'Doprava — Packeta Slovensko',         price: 130 },
};

// Fallback pro statické produkty z index.html (když Firestore neběží).
// Ceny musí odpovídat statickému seznamu PRODUCTS v index.html.
const FALLBACK_PRODUCTS = {
  'charlotte-set':          { name: 'Charlotte SET',               price: 2009 },
  'charlotte-nausnice':     { name: 'Charlotte náušnice',          price: 521 },
  'charlotte-naramek':      { name: 'Charlotte náramek',           price: 788 },
  'charlotte-nahrdelnik':   { name: 'Charlotte náhrdelník',        price: 987 },
  'silver-pearl':           { name: 'Silver Pearl',                price: 1221 },
  'charlotte-nausnice-rose':{ name: 'Charlotte náušnice Rose',     price: 577 },
  'charlotte-nahrdelnik-rose':{ name: 'Charlotte náhrdelník Rose', price: 1320 },
  'pure-silver-heart':      { name: 'Pure Silver Heart',           price: 1387 },
  'pure-nausnice':          { name: 'Pure náušnice',               price: 610 },
  'pure-nahrdelnik':        { name: 'Pure náhrdelník',             price: 1653 },
  'more-medvidek-nausnice': { name: 'Moře medvídek náušnice',      price: 499 },
  'more-medvidek':          { name: 'Moře medvídek',               price: 1542 },
  'more-kvet-nausnice':     { name: 'Moře Květ náušnice',          price: 555 },
  'more-kvet-nahrdelnik':   { name: 'Moře Květ náhrdelník',        price: 1520 },
  'more-nausnice':          { name: 'Moře náušnice',               price: 532 },
  'more':                   { name: 'Moře',                        price: 1332 },
};

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}$/;

async function resolveProduct(id) {
  const key = String(id);
  if (/^[A-Za-z0-9_-]{1,128}$/.test(key)) {
    try {
      const doc = await getDb().collection('products').doc(key).get();
      if (doc.exists) {
        const p = doc.data();
        if (p.inStock === false) return null;
        return { name: p.name, price: Number(p.price) };
      }
    } catch (e) {
      console.error('Firestore lookup failed:', e.message);
    }
  }
  return FALLBACK_PRODUCTS[key] || null;
}

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { items, shipping, customerEmail } = req.body || {};

    // ── Validace vstupu — klient posílá JEN id + qty, ceny určuje server ──
    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
      return res.status(400).json({ error: 'Neplatný košík' });
    }
    if (!SHIPPING[shipping]) {
      return res.status(400).json({ error: 'Neplatná doprava' });
    }

    const lineItems = [];
    for (const item of items) {
      const qty = Number(item?.qty);
      if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
        return res.status(400).json({ error: 'Neplatné množství' });
      }
      const product = await resolveProduct(item?.id);
      if (!product || !Number.isFinite(product.price) || product.price <= 0) {
        return res.status(400).json({ error: 'Produkt není dostupný' });
      }
      lineItems.push({
        price_data: {
          currency: 'czk',
          product_data: { name: String(product.name).slice(0, 200) },
          unit_amount: Math.round(product.price * 100), // haléře
        },
        quantity: qty,
      });
    }

    const ship = SHIPPING[shipping];
    lineItems.push({
      price_data: {
        currency: 'czk',
        product_data: { name: ship.label },
        unit_amount: ship.price * 100,
      },
      quantity: 1,
    });

    const email = typeof customerEmail === 'string' && EMAIL_RE.test(customerEmail.trim())
      ? customerEmail.trim()
      : undefined;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      customer_email: email,
      metadata: {
        shipping,
        items: JSON.stringify(items.map(i => ({ id: String(i.id), qty: Number(i.qty) }))).slice(0, 500),
      },
      success_url: `${SITE_URL}/?order=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/?order=cancel`,
    });

    res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: 'Platbu se nepodařilo vytvořit' });
  }
}
