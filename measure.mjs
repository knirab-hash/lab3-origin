// Lab 3 – CDN vs single origin: load the same file N times from each server.
// Every request uses a NEW connection (agent:false), like a first visit,
// so DNS + TCP + TLS (i.e. the network distance) are part of the time.
//
// Usage:  node measure.mjs <ORIGIN_URL> [runs=10]
// Example: node measure.mjs https://my-origin.onrender.com/jquery.min.js 10
import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';

const ORIGIN = process.argv[2];
const RUNS = Number(process.argv[3] || 10);
const targets = [
  { name: 'jsDelivr (CDN)', url: 'https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js' },
  { name: 'cdnjs (CDN)', url: 'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js' },
];
if (ORIGIN) targets.push({ name: 'Single origin', url: ORIGIN });
else console.log('No origin URL given: measuring the two CDNs only.\n');

const CACHE_HEADERS = ['x-cache', 'cf-cache-status', 'age', 'x-served-by', 'server', 'cache-control', 'via'];

function load(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const t = { start: performance.now() };
    const req = lib.get(url, { agent: false, headers: { 'User-Agent': 'lab3-measure' } }, res => {
      t.ttfb = performance.now();
      let bytes = 0;
      res.on('data', c => (bytes += c.length));
      res.on('end', () => {
        t.end = performance.now();
        const h = {};
        for (const k of CACHE_HEADERS) h[k] = res.headers[k] ?? '';
        resolve({
          status: res.statusCode,
          ip: res.socket.remoteAddress,
          dnsMs: t.dns ? t.dns - t.start : 0,
          connectMs: t.connect ? t.connect - (t.dns ?? t.start) : 0, // TCP handshake ≈ 1 round trip
          tlsMs: t.tls ? t.tls - t.connect : 0,
          ttfbMs: t.ttfb - t.start,
          totalMs: t.end - t.start,
          bytes,
          headers: h,
        });
      });
    });
    req.on('socket', s => {
      s.on('lookup', () => (t.dns = performance.now()));
      s.on('connect', () => (t.connect = performance.now()));
      s.on('secureConnect', () => (t.tls = performance.now()));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('timeout')));
  });
}

const r1 = x => Math.round(x * 10) / 10;
const stats = a => {
  const s = [...a].sort((x, y) => x - y);
  return { avg: r1(a.reduce((x, y) => x + y, 0) / a.length), median: r1(s[Math.floor(s.length / 2)]), min: r1(s[0]), max: r1(s.at(-1)) };
};

const rows = [];
for (let run = 1; run <= RUNS; run++) {
  for (const t of targets) { // alternate servers so both see the same network conditions
    try {
      const m = await load(t.url);
      const cache = m.headers['cf-cache-status'] || m.headers['x-cache'] || '(none)';
      rows.push({ server: t.name, run, ...m, cache });
      console.log(`${t.name.padEnd(16)} run ${String(run).padStart(2)}  ${m.status}  total ${r1(m.totalMs).toString().padStart(7)} ms  ttfb ${r1(m.ttfbMs).toString().padStart(7)} ms  cache: ${cache}`);
    } catch (e) {
      console.log(`${t.name} run ${run}: ERROR ${e.message}`);
    }
  }
}

// ---- summary ----
const summary = targets.map(t => {
  const rs = rows.filter(r => r.server === t.name);
  if (!rs.length) return { server: t.name, runs: 0 };
  const tot = stats(rs.map(r => r.totalMs)), ttfb = stats(rs.map(r => r.ttfbMs));
  const counts = {};
  for (const r of rs) counts[r.cache] = (counts[r.cache] || 0) + 1;
  return {
    server: t.name,
    ip: rs[0].ip,
    runs: rs.length,
    avgTotalMs: tot.avg, medianTotalMs: tot.median, minTotalMs: tot.min, maxTotalMs: tot.max,
    avgTtfbMs: ttfb.avg,
    avgConnectMs: stats(rs.map(r => r.connectMs)).avg,
    cacheStatus: Object.entries(counts).map(([k, v]) => `${k} x${v}`).join(', '),
    serverHeader: rs[0].headers.server,
  };
});
console.log('\nSUMMARY');
console.table(summary);

console.log('Response headers (first run of each server):');
for (const t of targets) {
  const r = rows.find(x => x.server === t.name);
  if (r) console.log(`\n${t.name}  (${r.ip})`, r.headers);
}

// ---- save CSV ----
fs.mkdirSync('results', { recursive: true });
const csv = (list, cols) => [cols.join(','), ...list.map(o => cols.map(c => `"${o[c] ?? ''}"`).join(','))].join('\n');
fs.writeFileSync('results/runs.csv', csv(rows.map(r => ({ ...r, ...r.headers, totalMs: r1(r.totalMs), ttfbMs: r1(r.ttfbMs), dnsMs: r1(r.dnsMs), connectMs: r1(r.connectMs), tlsMs: r1(r.tlsMs) })),
  ['server', 'run', 'status', 'ip', 'dnsMs', 'connectMs', 'tlsMs', 'ttfbMs', 'totalMs', 'bytes', 'cache', ...CACHE_HEADERS]));
fs.writeFileSync('results/summary.csv', csv(summary, Object.keys(summary.reduce((a, b) => (Object.keys(b).length > Object.keys(a).length ? b : a)))));
console.log('\nSaved results/runs.csv and results/summary.csv');
