// Place search proxy (TomTom Fuzzy Search: typo-tolerant, strong POI data). Uses the same TOMTOM_KEY; key stays server-side.
const KEY = process.env.TOMTOM_KEY;
const json = (c, b) => ({ statusCode: c, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) });
exports.handler = async (event) => {
  try {
    if (!KEY) return json(503, { error: 'Search not configured' });
    const q = event.queryStringParameters || {};
    const text = String(q.q || '').trim().slice(0, 100);
    if (text.length < 2) return json(400, { error: 'Query too short' });
    const p = new URLSearchParams({ key: KEY, typeahead: 'true', limit: '7', language: 'en-GB',
      idxSet: 'POI,Geo,PAD,Addr,Str', minFuzzyLevel: '1', maxFuzzyLevel: '2' });
    if (isFinite(+q.lat) && isFinite(+q.lon) && q.lat && q.lon) { p.set('lat', +q.lat); p.set('lon', +q.lon); } // bias only, no radius limit
    const r = await fetch('https://api.tomtom.com/search/2/search/' + encodeURIComponent(text) + '.json?' + p);
    if (!r.ok) return json(r.status === 429 ? 429 : 502, { error: 'TomTom ' + r.status });
    const j = await r.json();
    return json(200, { results: (j.results || []).filter(x => x.position).map(x => {
      const a = x.address || {}, free = a.freeformAddress || '';
      return { name: (x.poi && x.poi.name) || a.streetName || free.split(',')[0] || text,
        sub: free, lat: x.position.lat, lon: x.position.lon, type: x.type };
    }) });
  } catch (e) { return json(500, { error: e.message }); }
};
