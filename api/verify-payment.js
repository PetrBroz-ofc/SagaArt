const Stripe = require('stripe');
const { noStore, clientIp, fail, guard, limitOrReject } = require('./_utils');

// GET /api/verify-payment?session_id=cs_... — jen pro zobrazení „děkujeme“ po návratu ze Stripe.
// Objednávku jako zaplacenou označuje VÝHRADNĚ webhook s ověřeným podpisem.
export default async function handler(req, res) {
  noStore(res);
  if (!guard(req, res, ['GET'])) return;

  const sessionId = req.query?.session_id;
  if (typeof sessionId !== 'string' || !/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(sessionId)) {
    return fail(res, 400, 'Neplatné session_id');
  }
  if (!(await limitOrReject(res, 'verify_ip', clientIp(req), 20, 10 * 60 * 1000))) return;

  try {
    const session = await Stripe(process.env.STRIPE_SECRET_KEY).checkout.sessions.retrieve(sessionId);
    const paid = session.payment_status === 'paid';
    res.status(200).json({ paid, orderNumber: paid ? session.client_reference_id : null });
  } catch (err) {
    console.error('verify-payment error:', err.message);
    res.status(400).json({ paid: false });
  }
}
