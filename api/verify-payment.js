const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { applyCors } = require('./_utils');

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return res.status(405).end();

  const sessionId = req.query?.session_id;
  if (typeof sessionId !== 'string' || !/^cs_[A-Za-z0-9_]{10,200}$/.test(sessionId)) {
    return res.status(400).json({ error: 'Neplatné session_id' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    res.status(200).json({ paid: session.payment_status === 'paid' });
  } catch (err) {
    console.error('verify-payment error:', err.message);
    res.status(400).json({ paid: false });
  }
}
