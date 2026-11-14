// Serverless API. GET = active reports, POST = anyone adds a report, DELETE = admin only. GitHub repo = database.
const crypto = require('crypto');
const { GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH = 'main', ADMIN_PASSWORD } = process.env;
const FILE = 'data/active.json', TTL = 48 * 3600e3, CACHE_MS = 20000;
const TYPES = ['flood', 'closure', 'accident', 'damaged', 'ramp', 'footpath', 'stairs', 'avoid'];
const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE}`;
const H = { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'chaosnav' };
const res = (code, body) => ({ statusCode: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
let cache = { t: 0, list: [] };

function isAdmin(event) {
  const k = (event.headers || {})['x-admin-key'] || '';
  if (!ADMIN_PASSWORD || !k) return false;
  const h = s => crypto.createHash('sha256').update(s).digest();
  return crypto.timingSafeEqual(h(k), h(ADMIN_PASSWORD));
}
async function read() {
  const r = await fetch(`${url}?ref=${GITHUB_BRANCH}`, { headers: H });
  if (r.status === 404) return { list: [], sha: undefined };
  if (!r.ok) throw new Error('GitHub read ' + r.status);
  const j = await r.json();
  return { list: JSON.parse(Buffer.from(j.content, 'base64').toString() || '[]'), sha: j.sha };
}
async function mutate(fn, message) { // read-modify-write with retry on conflict
  for (let i = 0; i < 3; i++) {
    const { list, sha } = await read();
    const out = fn(list);
    const put = await fetch(url, { method: 'PUT', headers: H, body: JSON.stringify({ message, branch: GITHUB_BRANCH, sha,
      content: Buffer.from(JSON.stringify(out, null, 1)).toString('base64') }) });
    if (put.ok) { cache.t = 0; return true; }
    if (put.status !== 409 && put.status !== 422) throw new Error('GitHub write ' + put.status);
  }
  return false;
}

exports.handler = async (event) => {
  try {
    if (!GITHUB_TOKEN || !GITHUB_REPO) return res(500, { error: 'Server not configured' });
    const q = event.queryStringParameters || {};
    if (event.httpMethod === 'GET') {
      if (q.check) { if (isAdmin(event)) return res(200, { ok: true }); await new Promise(r => setTimeout(r, 800)); return res(401, { error: 'Unauthorized' }); }
      if (q.fresh || Date.now() - cache.t > CACHE_MS) cache = { t: Date.now(), list: (await read()).list };
      return res(200, { reports: cache.list.filter(r => r.exp > Date.now()) });
    }
    if (event.httpMethod === 'DELETE') { // only the software handler (admin password)
      if (!isAdmin(event)) { await new Promise(r => setTimeout(r, 800)); return res(401, { error: 'Unauthorized' }); }
      const id = String(q.id || ''); let found = false;
      const ok = await mutate(l => { found = l.some(r => r.id === id); return l.filter(r => r.id !== id); }, `admin: delete report ${id}`);
      if (!ok) return res(503, { error: 'Busy, try again' });
      return found ? res(200, { deleted: id }) : res(404, { error: 'Not found' });
    }
    if (event.httpMethod !== 'POST') return res(405, { error: 'Method not allowed' });
    const b = JSON.parse(event.body || '{}'), lat = +b.lat, lng = +b.lng;
    if (!TYPES.includes(b.type) || !isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
      return res(400, { error: 'Invalid report' });
    const now = Date.now();
    const rep = { id: now.toString(36) + Math.random().toString(36).slice(2, 6), type: b.type, lat, lng,
      r: Math.min(500, Math.max(10, +b.r || 50)), sev: [1, 2, 3].includes(+b.sev) ? +b.sev : 2,
      note: String(b.note || '').slice(0, 200), t: now, exp: now + TTL };
    const ok = await mutate(l => (l.push(rep), l), `report: ${rep.type} @ ${lat.toFixed(4)},${lng.toFixed(4)}`);
    return ok ? res(201, { report: rep }) : res(503, { error: 'Busy, try again' });
  } catch (e) { return res(500, { error: e.message }); }
};
