# Security Policy

## Hlášení zranitelností

Pokud najdete bezpečnostní chybu, napište prosím na **brozpetr.bp@gmail.com**.
Neprozrazujte prosím zranitelnost veřejně, dokud nebude opravena.

## Bezpečnostní opatření v projektu

- Ceny objednávek se počítají výhradně na serveru (`api/checkout.js`) — klientem
  poslané ceny se nikdy nepoužívají.
- Platby se ověřují proti Stripe (`api/verify-payment.js`) a zaznamenávají
  webhookem s ověřeným podpisem (`api/stripe-webhook.js`).
- Admin přihlášení vydává JWT s platností 12 hodin (`api/login.js`),
  s rate limitem a timing-safe porovnáním hesla.
- Zápisy do databáze procházejí whitelist validací polí (`api/products.js`).
- Veškerý dynamický obsah v HTML se escapuje proti XSS.
- CORS je omezen na vlastní doménu (viz `api/_utils.js`).

## Potřebné environment proměnné (Vercel)

| Proměnná | Účel |
| --- | --- |
| `ADMIN_PASSWORD` | heslo do admin panelu |
| `ADMIN_JWT_SECRET` | tajný klíč pro podepisování JWT (dlouhý náhodný řetězec) |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` | signing secret webhooku (`whsec_…`) |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Firebase Admin SDK |
| `SITE_URL` | volitelně — URL webu pro CORS a Stripe redirecty |
