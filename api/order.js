const Stripe = require('stripe');
const { getDb, SITE_URL, noStore, clientIp, fail, guard, limitOrReject } = require('./_utils');
const { SHIPPING, PAYMENTS, validateCustomer, priceCart, createOrder, sendOrderEmails, bankInfo } = require('./_shop');

// POST /api/order — vytvoří objednávku. Ceny, doprava i číslo objednávky určuje VÝHRADNĚ server.
export default async function handler(req, res) {
  noStore(res);
  if (!guard(req, res, ['POST'])) return;

  // max. 5 objednávek / 10 min z jedné IP (proti spamu a zahlcení)
  if (!(await limitOrReject(res, 'order_ip', clientIp(req), 5, 10 * 60 * 1000))) return;

  const { items, shipping, payment, customer, website } = req.body;

  // Honeypot — skryté pole, které vyplní jen bot. Tváříme se, že je vše OK.
  if (website) return res.status(200).json({ ok: true });

  if (!PAYMENTS[payment]) return fail(res, 400, 'Neplatný způsob platby');
  const cust = validateCustomer(customer, shipping);
  if (cust.error) return fail(res, 400, cust.error);

  try {
    const cart = await priceCart(items);
    if (cart.error) return fail(res, 400, cart.error);

    const shippingPrice = SHIPPING[shipping].price;
    const order = {
      status: payment === 'card' ? 'awaiting_payment' : 'awaiting_transfer',
      payment, shipping, shippingPrice,
      customer: cust.data,
      lines: cart.lines,
      subtotal: cart.subtotal,
      total: cart.subtotal + shippingPrice,
      emailsSent: false,
    };
    const number = await createOrder(order);
    order.number = number;

    // ── Bankovní převod: potvrzení e-mailem hned ──
    if (payment === 'transfer') {
      const sent = await sendOrderEmails(order);
      await getDb().collection('orders').doc(number).update({ emailsSent: sent });
      return res.status(200).json({ orderNumber: number, total: order.total, bank: bankInfo() });
    }

    // ── Karta: Stripe Checkout. E-maily pošle až webhook po ověřené platbě. ──
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      locale: 'cs',
      customer_email: cust.data.email,
      client_reference_id: number,
      metadata: { orderNumber: number },
      payment_intent_data: { metadata: { orderNumber: number } },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      line_items: [
        ...cart.lines.map(l => ({
          price_data: { currency: 'czk', product_data: { name: l.name }, unit_amount: l.price * 100 },
          quantity: l.qty,
        })),
        {
          price_data: { currency: 'czk', product_data: { name: 'Doprava: ' + SHIPPING[shipping].name }, unit_amount: shippingPrice * 100 },
          quantity: 1,
        },
      ],
      success_url: `${SITE_URL}/?order=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/?order=cancel`,
    }, { idempotencyKey: 'order-' + number });

    await getDb().collection('orders').doc(number).update({ stripeSessionId: session.id });
    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('order error:', err.message);
    return fail(res, 500, 'Objednávku se nepodařilo vytvořit. Zkuste to prosím znovu.');
  }
}
