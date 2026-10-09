const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getDb } = require('./_utils');

// Stripe podpis se ověřuje nad RAW tělem — vypnout automatický parser.
export const config = { api: { bodyParser: false } };

function rawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET není nastaven');
    return res.status(500).end();
  }

  let event;
  try {
    const buf = await rawBody(req);
    event = stripe.webhooks.constructEvent(
      buf,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      // doc(session.id) = idempotentní, opakované doručení nic nerozbije
      await getDb().collection('orders').doc(session.id).set({
        stripeSessionId: session.id,
        paymentStatus: session.payment_status,
        amountTotal: (session.amount_total || 0) / 100,
        currency: session.currency,
        customerEmail: session.customer_details?.email || session.customer_email || '',
        customerName: session.customer_details?.name || '',
        items: session.metadata?.items || '',
        shipping: session.metadata?.shipping || '',
        createdAt: new Date().toISOString(),
      });
    }
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).json({ error: 'Webhook error' });
  }
}
