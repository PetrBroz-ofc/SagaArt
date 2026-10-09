# Sága Art — e-shop

Ručně vyráběné šperky z pravých říčních perel, minerálů a nerezové oceli.

- `index.html` — obchod (kolekce, filtr, detail šperku, košík, 4krokový checkout)
- `admin.html` — správa šperků (heslo z `ADMIN_PASSWORD`)
- `api/` — Vercel serverless funkce (Stripe, Firestore, JWT)

## Před spuštěním doplnit
- `index.html` → `CONFIG`: EmailJS klíče, e-mail majitelky, číslo účtu / IBAN
- `admin.html` → `CLOUDINARY_CLOUD`, `CLOUDINARY_PRESET`
- Vercel env proměnné — viz `SECURITY.md`
- Ceny dopravy jsou ve dvou místech: `SHIPPING` v `index.html` a v `api/checkout.js`
