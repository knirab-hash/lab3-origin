// Lab 3 – single origin server (no CDN).
// Serves the same jQuery file the CDNs serve, from ONE machine in ONE location.
// Deploy it on a university server, a friend's hosting, or a free single-region host.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = process.env.PORT || 8000;
const FILE = path.join(__dirname, 'node_modules', 'jquery', 'dist', 'jquery.min.js');
const body = fs.readFileSync(FILE);

http.createServer((req, res) => {
  if (req.url.split('?')[0] === '/jquery.min.js') {
    res.writeHead(200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Content-Length': body.length,
      'Cache-Control': 'private, max-age=0', // no shared cache (proxy/CDN) may keep a copy: every request reaches this one server
      'Access-Control-Allow-Origin': '*',
      'Timing-Allow-Origin': '*',
      'X-Served-From': 'single-origin', // no CDN cache header here on purpose
    });
    return res.end(body);
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Lab 3 origin server. File: /jquery.min.js\n');
}).listen(PORT, () => console.log(`Origin server on port ${PORT} -> /jquery.min.js (${body.length} bytes)`));
