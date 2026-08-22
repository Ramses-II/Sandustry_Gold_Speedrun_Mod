// node ctx.js <datei> <muster> [kontext] [treffer]
const fs = require('fs');
const s = fs.readFileSync(process.argv[2], 'latin1');
const pat = process.argv[3];
const ctx = parseInt(process.argv[4] || '150', 10);
const max = parseInt(process.argv[5] || '5', 10);
const re = new RegExp(pat, 'g');
let m, n = 0;
while ((m = re.exec(s)) !== null && n < max) {
  n++;
  console.log(`--- @${m.index} ---`);
  console.log(s.slice(Math.max(0, m.index - ctx), m.index + m[0].length + ctx));
  if (m[0].length === 0) re.lastIndex++;
}
if (!n) console.log('keine Treffer: ' + pat);
