// Holt eine Datei aus app.asar heraus. node extract.js /main.js [ziel]
// Offsets: JSON-Headerlaenge in Bytes [12..16), JSON ab 16,
// Dateidaten ab baseOffset = 8 + readUInt32LE(4).
const fs = require('fs');
const ASAR = process.env.ASAR
  || 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Sandustry\\resources\\app.asar';

const fd = fs.openSync(ASAR, 'r');
const head = Buffer.alloc(16);
fs.readSync(fd, head, 0, 16, 0);
const jsonLen = head.readUInt32LE(12);
const json = Buffer.alloc(jsonLen);
fs.readSync(fd, json, 0, jsonLen, 16);
const baseOffset = 8 + head.readUInt32LE(4);
const tree = JSON.parse(json.toString('utf8'));

const want = process.argv[2];
let found = null;
(function walk(node, prefix) {
  for (const [name, v] of Object.entries(node.files || {})) {
    const p = prefix + '/' + name;
    if (v.files) walk(v, p);
    else if (p === want) found = v;
  }
})(tree, '');

if (!found) { console.error('nicht im Paket: ' + want); process.exit(2); }
if (found.unpacked) { console.error('liegt in app.asar.unpacked: ' + want); process.exit(2); }

const buf = Buffer.alloc(found.size);
fs.readSync(fd, buf, 0, found.size, baseOffset + Number(found.offset));
fs.closeSync(fd);

const out = process.argv[3] || ('.' + want.replace(/\//g, '_'));
fs.writeFileSync(out, buf);
console.log(`${want}  ->  ${out}  (${found.size} Bytes)`);
