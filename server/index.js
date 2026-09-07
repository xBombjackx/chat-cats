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
import { makeTwitchAuth } from './twitch-auth.js';
import { startEventSub } from './eventsub.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(path.join(ROOT, '.env')); } catch { /* no .env yet, fine */ }
const env = (k, d) => process.env[k] ?? d;

const PORT = +env('PORT', 8080);
const EVENTS = ['wrestlemania', 'catnip', 'fish', 'laser', 'nap', 'refill', 'clearprops'];
const MAX_PLAYERS = +env('MAX_PLAYERS', 50);   // companion page viewers

const db = openDb(path.resolve(ROOT, env('DB_PATH', 'chatcats.sqlite')));
const status = { twitch: false, kick: false, eventsub: false, twitchUser: null, overlays: 0, players: 0 };
// settings: .env gives defaults, /admin can change them live (stored in sqlite)
const DEFAULTS = { cooldownMs: +env('COOLDOWN_MS', 2500), maxCats: +env('MAX_CATS', 30), respawnHours: +env('RESPAWN_HOURS', 6) };
const cfg = { ...DEFAULTS, ...db.get('settings', {}) };
function setSettings(patch) {
  for (const k of Object.keys(DEFAULTS)) if (patch[k] != null && Number.isFinite(+patch[k])) cfg[k] = Math.max(0, +patch[k]);
  db.set('settings', cfg);
  broadcast({ type: 'config', maxCats: cfg.maxCats }, 'overlay');
  return cfg;
}

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
    cats: db.recentCats(cfg.respawnHours * 3600e3, cfg.maxCats),
    props: db.get('props', null),
    zones: db.get('zones', []),
    maxCats: cfg.maxCats,
  };
}

// ---------- chat pipeline ----------
const lastCmd = new Map();   // key -> ms
function onChat({ platform, user, id, msg }) {
  msg = String(msg ?? '').trim();
  if (!msg.startsWith('!')) return;
  const key = `${platform}:${(id || user).toLowerCase()}`;
  const now = Date.now();
  if (platform !== 'admin' && now - (lastCmd.get(key) || 0) < cfg.cooldownMs) {
    broadcast({ type: 'cooldown', key }, 'overlay');   // the cat shows a little hourglass
    broadcast({ type: 'log', platform, user, msg: msg + ' (cooldown)' }, 'admin');
    return;
  }
  lastCmd.set(key, now);
  if (lastCmd.size > 5000) for (const [k, t] of lastCmd) if (now - t > 60e3) lastCmd.delete(k);
  db.touchCat(key);
  broadcast({ type: 'chat', platform, user, key, msg }, 'overlay');
  broadcast({ type: 'log', platform, user, msg }, 'admin');
}
function fireEvent(name, by = 'admin') {
  if (!EVENTS.includes(name)) return false;
  broadcast({ type: 'event', name }, 'overlay');
  broadcast({ type: 'log', platform: 'event', user: by, msg: name }, 'admin');
  return true;
}
// ---------- twitch eventsub ----------
// channel point redeems map reward title -> action: "!command" runs as the redeemer (user input appended), else an event name
function onTwitchEvent(ev) {
  broadcast({ type: 'log', platform: 'twitch', user: ev.user, msg: describe(ev) }, 'admin');
  if (ev.kind === 'redeem') {
    const map = db.get('redeems', {}), action = map[ev.reward.toLowerCase()];
    if (!action) return;
    if (action.startsWith('!')) { const msg = (action + ' ' + ev.input).trim(); lastCmd.delete(`twitch:${ev.id.toLowerCase()}`); onChat({ platform: 'twitch', user: ev.user, id: ev.id, msg }); }
    else fireEvent(action, ev.user);
    return;
  }
  broadcast({ type: 'twitch', ...ev }, 'overlay');
}
function describe(ev) {
  switch (ev.kind) {
    case 'follow': return 'followed';
    case 'sub': return `subscribed (tier ${ev.tier / 1000})`;
    case 'resub': return `resubbed, ${ev.months} months`;
    case 'gift': return `gifted ${ev.count} subs`;
    case 'cheer': return `cheered ${ev.bits} bits`;
    case 'raid': return `raided with ${ev.viewers} viewers`;
    case 'redeem': return `redeemed "${ev.reward}"${ev.input ? `: ${ev.input}` : ''}`;
  }
  return ev.kind;
}
const twitch = env('TWITCH_CLIENT_ID') && env('TWITCH_CLIENT_SECRET') && makeTwitchAuth({
  clientId: env('TWITCH_CLIENT_ID'), clientSecret: env('TWITCH_CLIENT_SECRET'), db,
  redirectUri: env('TWITCH_REDIRECT_URI', `http://localhost:${PORT}/auth/callback`),
  idUrl: env('TWITCH_ID_URL', undefined), apiUrl: env('TWITCH_API_URL', undefined),
});
let stopEventSub = null;
function startTwitch() {
  if (!twitch?.connected) return;
  stopEventSub?.();
  status.twitchUser = twitch.user?.login || null;
  stopEventSub = startEventSub({ wsUrl: env('TWITCH_EVENTSUB_URL', undefined), helix: twitch.helix, userId: twitch.user.id, onEvent: onTwitchEvent,
    onStatus: ok => { status.eventsub = ok; sendStatus(); } });
}
if (twitch) startTwitch(); else console.log('no TWITCH_CLIENT_ID/SECRET in .env — subs/bits/raids/redeems off');

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
    if (p === '/api/settings') {
      if (req.method === 'POST') { try { setSettings(JSON.parse(await readBody(req) || '{}')); } catch { return json(res, 400, { ok: false, error: 'bad json' }); } }
      return json(res, 200, { ...cfg, defaults: DEFAULTS });
    }
    const ev = p.match(/^\/api\/event\/([a-z]+)$/);
    if (ev) return fireEvent(ev[1]) ? json(res, 200, { ok: true, event: ev[1] }) : json(res, 404, { ok: false, error: 'unknown event', events: EVENTS });
    if (p === '/api/chat') {
      let user = url.searchParams.get('user'), msg = url.searchParams.get('msg');
      if (req.method === 'POST') { try { const b = JSON.parse(await readBody(req) || '{}'); user = b.user ?? user; msg = b.msg ?? msg; } catch { return json(res, 400, { ok: false, error: 'bad json' }); } }
      if (!msg) return json(res, 400, { ok: false, error: 'msg required' });
      const platform = ['twitch', 'kick', 'sim'].includes(url.searchParams.get('platform')) ? url.searchParams.get('platform') : 'admin';   // non-admin = cooldowns apply
      onChat({ platform, user: user || 'streamer', msg });
      return json(res, 200, { ok: true });
    }
    if (p === '/api/twitch') {
      if (!twitch) return json(res, 200, { configured: false });
      let rewards = [];
      if (twitch.connected && url.searchParams.get('rewards')) { try { rewards = (await twitch.helix(`/channel_points/custom_rewards?broadcaster_id=${twitch.user.id}`)).data.map(r => r.title); } catch (e) { rewards = [`(couldn't list rewards: ${e.message})`]; } }
      return json(res, 200, { configured: true, connected: twitch.connected, user: twitch.info, eventsub: status.eventsub, rewards, redeems: db.get('redeems', {}), events: EVENTS });
    }
    if (p === '/api/twitch/disconnect' && req.method === 'POST') { stopEventSub?.(); stopEventSub = null; twitch?.disconnect(); status.eventsub = false; status.twitchUser = null; sendStatus(); return json(res, 200, { ok: true }); }
    if (p === '/api/redeems' && req.method === 'POST') {
      let map; try { map = JSON.parse(await readBody(req)); } catch { return json(res, 400, { ok: false, error: 'bad json' }); }
      const clean = {}; for (const [k, v] of Object.entries(map || {})) if (k.trim() && typeof v === 'string' && v.trim()) clean[k.trim().toLowerCase()] = v.trim();
      db.set('redeems', clean); return json(res, 200, { ok: true, redeems: clean });
    }
    if (p === '/api/test') {   // simulate an eventsub event: /api/test?kind=raid&user=bob&viewers=40
      const ev = Object.fromEntries(url.searchParams); ev.id = ev.id || ev.user || 'tester'; ev.user = ev.user || 'tester';
      for (const k of ['viewers', 'bits', 'count', 'months', 'tier']) if (ev[k] != null) ev[k] = +ev[k];
      if (!ev.kind) return json(res, 400, { ok: false, error: 'kind required: follow sub resub gift cheer raid redeem' });
      onTwitchEvent(ev); return json(res, 200, { ok: true, ev });
    }
    return json(res, 404, { ok: false });
  }
  if (p === '/auth') { if (!twitch) return json(res, 400, { error: 'set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET in .env' }); res.writeHead(302, { location: twitch.authUrl('cats') }); return res.end(); }
  if (p === '/auth/callback') {
    const code = url.searchParams.get('code');
    if (!code || !twitch) { res.writeHead(400); return res.end(`twitch auth failed: ${url.searchParams.get('error_description') || 'no code'}`); }
    try { await twitch.exchange(code); startTwitch(); sendStatus(); res.writeHead(302, { location: '/admin' }); return res.end(); }
    catch (e) { res.writeHead(500); return res.end('twitch auth failed: ' + e.message); }
  }
  if (p === '/admin' || p === '/admin/') return serveFile(res, path.join(ROOT, 'server', 'admin.html'));
  if (p === '/play' || p === '/play/') { res.writeHead(302, { location: '/?mode=play' }); return res.end(); }
  // static overlay
  const rel = p === '/' ? 'index.html' : p.replace(/^\/+/, '');
  const file = path.join(ROOT, 'overlay', rel);
  if (!file.startsWith(path.join(ROOT, 'overlay'))) { res.writeHead(403); return res.end(); }
  serveFile(res, file);
});

const wss = new WebSocketServer({ server });
let primary = null;   // the overlay whose cat positions get mirrored to the companion page
function sendWatchers() { broadcast({ type: 'watchers', n: status.players }, 'overlay'); }
wss.on('connection', ws => {
  const c = { ws, role: 'overlay' };
  clients.add(c);
  ws.on('message', buf => {
    let m; try { m = JSON.parse(buf.toString()); } catch { return; }
    switch (m.type) {
      case 'hello':
        c.role = ['admin', 'play'].includes(m.role) ? m.role : 'overlay';
        if (c.role === 'overlay') { status.overlays++; primary ??= c; ws.send(JSON.stringify(initPayload())); sendStatus(); sendWatchers(); }
        else if (c.role === 'play') {
          if (status.players >= MAX_PLAYERS) { ws.send(JSON.stringify({ type: 'full' })); ws.close(); return; }
          status.players++; ws.send(JSON.stringify(initPayload())); sendStatus(); sendWatchers();
        }
        else ws.send(JSON.stringify({ type: 'status', ...status }));
        break;
      case 'state': if (c === primary && status.players) broadcast({ type: 'state', cats: m.cats, t: Date.now() }, 'play'); break;
      case 'poke': {   // companion click; 1/s per viewer
        if (c.role !== 'play') break;
        const now = Date.now(); if (now - (c.lastPoke || 0) < 1000) break; c.lastPoke = now;
        if (Number.isFinite(+m.x) && Number.isFinite(+m.z)) broadcast({ type: 'poke', x: +m.x, z: +m.z }, 'overlay');
        break; }
      case 'cat': if (m.key && m.look) db.saveCat(m.key, m.name || m.key, m.look); break;
      case 'catgone': if (m.key) db.deleteCat(m.key); break;
      case 'props': if (Array.isArray(m.props)) db.set('props', m.props); break;
      case 'zones': if (Array.isArray(m.zones)) db.set('zones', m.zones); break;
      case 'chat': onChat({ platform: 'admin', user: m.user || 'streamer', msg: m.msg }); break;   // from admin page
      case 'event': fireEvent(m.name); break;
    }
  });
  ws.on('close', () => {
    clients.delete(c);
    if (c.role === 'overlay') { status.overlays = Math.max(0, status.overlays - 1); if (primary === c) primary = [...clients].find(x => x.role === 'overlay') || null; }
    if (c.role === 'play') status.players = Math.max(0, status.players - 1);
    sendStatus(); sendWatchers();
  });
});

// ---------- chat sources ----------
const twitchCh = env('TWITCH_CHANNEL'), kickCh = env('KICK_CHANNEL');
if (twitchCh) connectTwitch(twitchCh.replace(/^#/, ''), onChat, ok => { status.twitch = ok; sendStatus(); });
if (kickCh) connectKick(kickCh, env('KICK_CHATROOM_ID'), onChat, ok => { status.kick = ok; sendStatus(); });
if (!twitchCh && !kickCh) console.log('no TWITCH_CHANNEL / KICK_CHANNEL in .env — running with admin/simulated chat only');

server.listen(PORT, () => {
  console.log(`chat-cats  overlay: http://localhost:${PORT}/?ui=0&bg=0   admin: http://localhost:${PORT}/admin`);
});
