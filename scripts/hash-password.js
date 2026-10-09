// Vygeneruje ADMIN_PASSWORD_HASH (scrypt). Heslo se nikam neukládá ani neodesílá.
// Použití: npm run hash-password
const crypto = require('crypto');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
rl._writeToOutput = s => { if (!rl.stdoutMuted) rl.output.write(s); };

rl.question('Nové heslo do adminu (min. 14 znaků): ', password => {
  rl.close();
  process.stdout.write('\n');
  if (password.length < 14) {
    console.error('Heslo je příliš krátké — použij aspoň 14 znaků (ideálně větu nebo správce hesel).');
    process.exit(1);
  }
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  console.log('\nVlož do Vercelu jako ADMIN_PASSWORD_HASH:\n');
  console.log(`scrypt$${salt.toString('hex')}$${hash.toString('hex')}\n`);
});
rl.stdoutMuted = true;
