// Serverless API: GET active reports / POST a new report. GitHub repo = database. Token stays server-side.
const { GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH = 'main' } = process.env;
const FILE = 'data/active.json', TTL = 48 * 3600e3;
const TYPES = ['flood', 'closure', 'accident', 'damaged', 'ramp', 'footpath', 'stairs', 'avoid'];
const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE}`;
const H = { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'chaosnav' };
const res = (code, body) => ({ statusCode: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });

async function read() {
  const r = await fetch(`${url}?ref=${GITHUB_BRANCH}`, { headers: H });
  if (r.status === 404) return { list: [], sha: undefined };
  if (!r.ok) throw new Error('GitHub read ' + r.status);
  const j = await r.json();
  return { list: JSON.parse(Buffer.from(j.content, 'base64').toString() || '[]'), sha: j.sha };
}

exports.handler = async (event) => {
  try {
    if (!GITHUB_TOKEN || !GITHUB_REPO) return res(500, { error: 'Server not configured' });
    if (event.httpMethod === 'GET') {
      const { list } = await read();
      return res(200, { reports: list.filter(r => r.exp > Date.now()) });
    }
    if (event.httpMethod !== 'POST') return res(405, { error: 'Method not allowed' });
    const b = JSON.parse(event.body || '{}');
    const lat = +b.lat, lng = +b.lng;
    if (!TYPES.includes(b.type) || !isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
      return res(400, { error: 'Invalid report' });
    const now = Date.now();
    const rep = { id: now.toString(36) + Math.random().toString(36).slice(2, 6), type: b.type, lat, lng,
      r: Math.min(500, Math.max(10, +b.r || 50)), sev: [1, 2, 3].includes(+b.sev) ? +b.sev : 2,
      note: String(b.note || '').slice(0, 200), t: now, exp: now + TTL };
    for (let i = 0; i < 3; i++) { // retry on write conflict
      const { list, sha } = await read();
      list.push(rep);
      const put = await fetch(url, { method: 'PUT', headers: H, body: JSON.stringify({
        message: `report: ${rep.type} @ ${lat.toFixed(4)},${lng.toFixed(4)}`, branch: GITHUB_BRANCH, sha,
        content: Buffer.from(JSON.stringify(list, null, 1)).toString('base64') }) });
      if (put.ok) return res(201, { report: rep });
      if (put.status !== 409 && put.status !== 422) throw new Error('GitHub write ' + put.status);
    }
    return res(503, { error: 'Busy, try again' });
  } catch (e) { return res(500, { error: e.message }); }
};
