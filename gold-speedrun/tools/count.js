// Zaehlt Vorkommen mehrerer Muster im app.asar. node count.js muster1 muster2 ...
const fs = require('fs');
const ASAR = process.env.ASAR
  || 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Sandustry\\resources\\app.asar';
const src = fs.readFileSync(ASAR, 'latin1');
for (const pat of process.argv.slice(2)) {
  const n = (src.match(new RegExp(pat, 'g')) || []).length;
  console.log(String(n).padStart(6) + '  ' + pat);
}
