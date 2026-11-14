// Optional LIVE traffic routing via TomTom (free tier). Key stays server-side. Without TOMTOM_KEY the app falls back to its typical-traffic model.
const KEY = process.env.TOMTOM_KEY;
const json = (c, b) => ({ statusCode: c, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) });
const PT = '-?\\d+(\\.\\d+)?,-?\\d+(\\.\\d+)?';
const OK = new RegExp(`^${PT}(:${PT}){1,4}$`);

exports.handler = async (event) => {
  try {
    const q = event.queryStringParameters || {};
    if (q.status) return json(200, { enabled: !!KEY });
    if (!KEY) return json(503, { error: 'Live traffic not configured' });
    const pts = String(q.pts || '');                       // "lat,lon:lat,lon[:lat,lon]"
    if (!OK.test(pts)) return json(400, { error: 'Bad points' });
    const alts = pts.split(':').length === 2 ? 2 : 0;       // alternatives only for plain A->B
    const u = `https://api.tomtom.com/routing/1/calculateRoute/${pts}/json?key=${KEY}&traffic=true&travelMode=car&maxAlternatives=${alts}&computeTravelTimeFor=all`;
    const r = await fetch(u);
    if (!r.ok) return json(r.status === 429 ? 429 : 502, { error: 'TomTom ' + r.status });
    const j = await r.json();
    return json(200, { routes: (j.routes || []).map(x => ({
      dist: x.summary.lengthInMeters, dur: x.summary.travelTimeInSeconds,
      free: x.summary.noTrafficTravelTimeInSeconds || x.summary.travelTimeInSeconds,
      coords: x.legs.flatMap(l => l.points.map(p => [p.latitude, p.longitude])) })) });
  } catch (e) { return json(500, { error: e.message }); }
};
