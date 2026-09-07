// chat-cats server: Twitch/Kick chat -> websocket -> overlay. Also serves the overlay, an admin page,
// and HTTP endpoints for Stream Deck. State (cat looks, prop layout) persists in SQLite.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { openDb } from './db.js';
import { connectTwitch } from './twitch.js';
import { connectKick } from './kick.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(path.join(ROOT, '.env')); } catch { /* no .env yet, fine */ }
const env = (k, d) => process.env[k] ?? d;

const PORT = +env('PORT', 8080);
const COOLDOWN_MS = +env('COOLDOWN_MS', 2500);   // per user, between accepted commands
const MAX_CATS = +env('MAX_CATS', 30);
const RESPAWN_HOURS = +env('RESPAWN_HOURS', 6);   // cats seen within this window come back on overlay load
const EVENTS = ['wrestlemania', 'catnip', 'fish', 'laser', 'nap', 'refill', 'clearprops'];

const db = openDb(path.resolve(ROOT, env('DB_PATH', 'chatcats.sqlite')));
const status = { twitch: false, kick: false, overlays: 0 };

// ---------- websocket hub ----------
const clients = new Set();   // {ws, role}
function broadcast(obj, role) {
  const s = JSON.stringify(obj);
  for (const c of clients) if ((!role || c.role === role) && c.ws.readyState === 1) c.ws.send(s);
}
function sendStatus() { broadcast({ type: 'status', ...status }, 'admin'); }

function initPayload() {
  return {
    type: 'init',
    cats: db.recentCats(RESPAWN_HOURS * 3600e3, MAX_CATS),
    props: db.get('props', null),
    maxCats: MAX_CATS,
  };
}

// ---------- chat pipeline ----------
const lastCmd = new Map();   // key -> ms
function onChat({ platform, user, id, msg }) {
  msg = String(msg ?? '').trim();
  if (!msg.startsWith('!')) return;
  const key = `${platform}:${(id || user).toLowerCase()}`;
  const now = Date.now();
  if (platform !== 'admin' && now - (lastCmd.get(key) || 0) < COOLDOWN_MS) return;
  lastCmd.set(key, now);
  if (lastCmd.size > 5000) for (const [k, t] of lastCmd) if (now - t > 60e3) lastCmd.delete(k);
  db.touchCat(key);
  broadcast({ type: 'chat', platform, user, key, msg }, 'overlay');
  broadcast({ type: 'log', platform, user, msg }, 'admin');
}
function fireEvent(name) {
  if (!EVENTS.includes(name)) return false;
  broadcast({ type: 'event', name }, 'overlay');
  broadcast({ type: 'log', platform: 'event', user: 'admin', msg: name }, 'admin');
  return true;
}

// ---------- http ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
function serveFile(res, file) {
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  });
}
function json(res, code, obj) { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); }
function readBody(req) { return new Promise(r => { let b = ''; req.on('data', c => b += c); req.on('end', () => r(b)); }); }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  // API — GET is allowed too so Stream Deck's "Website" action can fire events
  if (p.startsWith('/api/')) {
    if (p === '/api/status') return json(res, 200, status);
    const ev = p.match(/^\/api\/event\/([a-z]+)$/);
    if (ev) return fireEvent(ev[1]) ? json(res, 200, { ok: true, event: ev[1] }) : json(res, 404, { ok: false, error: 'unknown event', events: EVENTS });
    if (p === '/api/chat') {
      let user = url.searchParams.get('user'), msg = url.searchParams.get('msg');
      if (req.method === 'POST') { try { const b = JSON.parse(await readBody(req) || '{}'); user = b.user ?? user; msg = b.msg ?? msg; } catch { return json(res, 400, { ok: false, error: 'bad json' }); } }
      if (!msg) return json(res, 400, { ok: false, error: 'msg required' });
      onChat({ platform: 'admin', user: user || 'streamer', msg });
      return json(res, 200, { ok: true });
    }
    return json(res, 404, { ok: false });
  }
  if (p === '/admin' || p === '/admin/') return serveFile(res, path.join(ROOT, 'server', 'admin.html'));
  // static overlay
  const rel = p === '/' ? 'index.html' : p.replace(/^\/+/, '');
  const file = path.join(ROOT, 'overlay', rel);
  if (!file.startsWith(path.join(ROOT, 'overlay'))) { res.writeHead(403); return res.end(); }
  serveFile(res, file);
});

const wss = new WebSocketServer({ server });
wss.on('connection', ws => {
  const c = { ws, role: 'overlay' };
  clients.add(c);
  ws.on('message', buf => {
    let m; try { m = JSON.parse(buf.toString()); } catch { return; }
    switch (m.type) {
      case 'hello':
        c.role = m.role === 'admin' ? 'admin' : 'overlay';
        if (c.role === 'overlay') { status.overlays++; ws.send(JSON.stringify(initPayload())); sendStatus(); }
        else ws.send(JSON.stringify({ type: 'status', ...status }));
        break;
      case 'cat': if (m.key && m.look) db.saveCat(m.key, m.name || m.key, m.look); break;
      case 'catgone': if (m.key) db.deleteCat(m.key); break;
      case 'props': if (Array.isArray(m.props)) db.set('props', m.props); break;
      case 'chat': onChat({ platform: 'admin', user: m.user || 'streamer', msg: m.msg }); break;   // from admin page
      case 'event': fireEvent(m.name); break;
    }
  });
  ws.on('close', () => { if (c.role === 'overlay') status.overlays = Math.max(0, status.overlays - 1); clients.delete(c); sendStatus(); });
});

// ---------- chat sources ----------
const twitchCh = env('TWITCH_CHANNEL'), kickCh = env('KICK_CHANNEL');
if (twitchCh) connectTwitch(twitchCh.replace(/^#/, ''), onChat, ok => { status.twitch = ok; sendStatus(); });
if (kickCh) connectKick(kickCh, env('KICK_CHATROOM_ID'), onChat, ok => { status.kick = ok; sendStatus(); });
if (!twitchCh && !kickCh) console.log('no TWITCH_CHANNEL / KICK_CHANNEL in .env — running with admin/simulated chat only');

server.listen(PORT, () => {
  console.log(`chat-cats  overlay: http://localhost:${PORT}/?ui=0&bg=0   admin: http://localhost:${PORT}/admin`);
});
