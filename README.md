# Lab 3 – CDN and Edge vs Single Server

Loads the same file (jQuery 3.7.1) from two public CDNs (jsDelivr, cdnjs) and from one single origin server, 10 times each, and records load time and cache headers.

Live origin: https://lab3-origin.onrender.com/jquery.min.js (Render, Oregon – us-west1)

## Files
| File | Purpose |
|------|---------|
| `server.js` | Single origin server: serves `/jquery.min.js` from one machine, `Cache-Control: private, max-age=0` so no shared cache keeps a copy |
| `measure.mjs` | Loads each URL N times on a new connection; records DNS, connect, TLS, TTFB, total time, IP and cache headers; saves `results/*.csv` |

## Run the origin server
```bash
npm install
npm start          # PORT env var, default 8000
```

## Measure
```bash
node measure.mjs https://lab3-origin.onrender.com/jquery.min.js 10
```

## Network distance
```bash
ping -n 10 cdn.jsdelivr.net
tracert cdn.jsdelivr.net
ping -n 10 lab3-origin.onrender.com
tracert lab3-origin.onrender.com
```
