// Listet den Inhalt von app.asar. node lsasar.js [filter]
const fs = require('fs');
const ASAR = process.env.ASAR
  || 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Sandustry\\resources\\app.asar';

const fd = fs.openSync(ASAR, 'r');
const head = Buffer.alloc(16);
fs.readSync(fd, head, 0, 16, 0);
const jsonLen = head.readUInt32LE(12);
const json = Buffer.alloc(jsonLen);
fs.readSync(fd, json, 0, jsonLen, 16);
fs.closeSync(fd);

const baseOffset = 8 + head.readUInt32LE(4);
const tree = JSON.parse(json.toString('utf8'));

const filter = process.argv[2];
const rows = [];
(function walk(node, prefix) {
  for (const [name, v] of Object.entries(node.files || {})) {
    const p = prefix + '/' + name;
    if (v.files) walk(v, p);
    else rows.push({ path: p, size: v.size || 0, offset: v.offset, unpacked: !!v.unpacked });
  }
})(tree, '');

console.log('baseOffset = ' + baseOffset + ', Header = ' + jsonLen + ' Bytes, Eintraege = ' + rows.length);
console.log('');

const shown = filter ? rows.filter(r => r.path.toLowerCase().includes(filter.toLowerCase())) : rows;
shown.sort((a, b) => b.size - a.size);
for (const r of shown.slice(0, 60)) {
  console.log(
    String(r.size).padStart(12) + '  ' +
    (r.unpacked ? 'UNPACKED  ' : '          ') +
    r.path);
}
if (shown.length > 60) console.log(`... und ${shown.length - 60} weitere`);
