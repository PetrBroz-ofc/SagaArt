// Vygeneruje tajný klíč pro dvoufázové ověření (Google Authenticator, Microsoft Authenticator, Authy…).
// Použití: npm run totp-setup
const crypto = require('crypto');

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const bytes = crypto.randomBytes(20);
let bits = 0, value = 0, secret = '';
for (const b of bytes) {
  value = (value << 8) | b;
  bits += 8;
  while (bits >= 5) { secret += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; }
}
if (bits > 0) secret += alphabet[(value << (5 - bits)) & 31];

const label = encodeURIComponent('Sága Art:admin');
const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent('Sága Art')}&algorithm=SHA1&digits=6&period=30`;

console.log('\n1) Vlož do Vercelu jako ADMIN_TOTP_SECRET:\n');
console.log('   ' + secret + '\n');
console.log('2) V aplikaci Authenticator zvol „Zadat klíč ručně“ a vlož stejný klíč,');
console.log('   nebo z tohoto odkazu vytvoř QR kód (offline!):\n');
console.log('   ' + uri + '\n');
console.log('Klíč nikomu neposílej a neukládej do repozitáře.\n');
