// Moves reports older than 48h from data/active.json to data/archive/YYYY-MM.json
const fs = require('fs'), F = 'data/active.json';
const all = JSON.parse(fs.readFileSync(F, 'utf8') || '[]'), now = Date.now();
const old = all.filter(r => r.exp <= now), live = all.filter(r => r.exp > now);
if (!old.length) process.exit(0);
fs.mkdirSync('data/archive', { recursive: true });
const by = {};
old.forEach(r => (by[new Date(r.t).toISOString().slice(0, 7)] ||= []).push(r));
for (const [m, v] of Object.entries(by)) {
  const p = `data/archive/${m}.json`;
  const ex = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : [];
  fs.writeFileSync(p, JSON.stringify(ex.concat(v), null, 1));
}
fs.writeFileSync(F, JSON.stringify(live, null, 1));
console.log('Archived', old.length, 'report(s)');
