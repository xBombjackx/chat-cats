// chat-cats server: Twitch/Kick chat -> websocket -> overlay. Also serves the overlay, an admin page,
// and HTTP endpoints for Stream Deck. State (cat looks, prop layout) persists in SQLite.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';
import { openDb } from './db.js';
import { connectTwitch } from './twitch.js';
import { connectKick } from './kick.js';
import { makeTwitchAuth } from './twitch-auth.js';
import { startEventSub } from './eventsub.js';

process.on('unhandledRejection', e => console.error('[unhandled]', e?.stack || e));
process.on('uncaughtException', e => console.error('[uncaught]', e?.stack || e));
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(path.join(ROOT, '.env')); } catch { /* no .env yet, fine */ }
const env = (k, d) => process.env[k] ?? d;

const PORT = +env('PORT', 8080);
const EVENTS = ['wrestlemania', 'catnip', 'fish', 'laser', 'nap', 'race', 'feeding', 'treat', 'boxes', 'vacuum', 'doorbell', 'cucumber', 'confetti', 'birthday', 'weather', 'beds', 'rlgl', 'photo', 'catniproulette', 'boxroulette', 'holiday', 'refill', 'clearprops', 'clearcats'];
const MAX_PLAYERS = +env('MAX_PLAYERS', 50);   // companion page viewers
const KEY = env('ADMIN_KEY', '');   // set this if the server is reachable from the internet (companion page via a tunnel): gates /admin, /api, /auth and the overlay socket
let oauthState = null;

const db = openDb(path.resolve(ROOT, env('DB_PATH', 'chatcats.sqlite')));
const status = { twitch: false, kick: false, eventsub: false, twitchUser: null, overlays: 0, players: 0 };
// settings: .env gives defaults, /admin can change them live (stored in sqlite)
const DEFAULTS = { predictions: +env('PREDICTIONS', 1), daynight: +env('DAYNIGHT', 0), cooldownMs: +env('COOLDOWN_MS', 2500), maxCats: +env('MAX_CATS', 30), respawnHours: +env('RESPAWN_HOURS', 6) };
const cfg = { ...DEFAULTS, ...db.get('settings', {}) };
const ENVS = ['none', 'bedroom', 'kitchen', 'living', 'garden'];
cfg.env = ENVS.includes(cfg.env) ? cfg.env : env('ENV', 'none');
const SPECIES_MODES = ['cat', 'dog', 'raccoon', 'otter', 'mixed'];
const HOLIDAYS = ['none', 'halloween', 'xmas'];
cfg.holiday = HOLIDAYS.includes(cfg.holiday) ? cfg.holiday : 'none';
cfg.species = SPECIES_MODES.includes(cfg.species) ? cfg.species : env('SPECIES', 'cat');
function setSettings(patch) {
  for (const k of Object.keys(DEFAULTS)) if (patch[k] != null && Number.isFinite(+patch[k])) cfg[k] = Math.max(0, Math.round(+patch[k]));
  if (ENVS.includes(patch.env)) cfg.env = patch.env;
  if (SPECIES_MODES.includes(patch.species)) cfg.species = patch.species;
  if (HOLIDAYS.includes(patch.holiday)) cfg.holiday = patch.holiday;
  db.set('settings', cfg);
  const config = { type: 'config', maxCats: cfg.maxCats, env: cfg.env, species: cfg.species, daynight: cfg.daynight, holiday: cfg.holiday };
  broadcast(config, 'overlay'); broadcast(config, 'play');
  return cfg;
}

// ---------- websocket hub ----------
const clients = new Set();   // {ws, role}
function broadcast(obj, role) {
  const s = JSON.stringify(obj);
  for (const c of clients) if ((!role || c.role === role) && c.ws.readyState === 1) c.ws.send(s);
}
function sendStatus() { broadcast({ type: 'status', ...status }, 'admin'); }

const STATS = ['naps', 'pets', 'zoomies', 'wins', 'boops', 'cmds'];
const levelOf = key => Math.floor(Math.sqrt(db.statOf(key, 'cmds') / 8));   // loyalty: 8 commands → lvl 1, 200 → lvl 5, 800 → lvl 10
function catOfTheDay() {   // one random cat seen in the last week, fixed for the calendar day
  const today = new Date().toISOString().slice(0, 10);
  let c = db.get('cotd', null);
  if (!c || c.date !== today) { const pick = db.randomCat(7 * 86400e3); c = pick ? { date: today, key: pick.key, name: pick.name } : null; if (c) db.set('cotd', c); }
  return c;
}
function initPayload() {
  return {
    type: 'init',
    cotd: catOfTheDay(),
    env: cfg.env,
    species: cfg.species,
    daynight: cfg.daynight,
    holiday: cfg.holiday,
    cats: db.recentCats(cfg.respawnHours * 3600e3, cfg.maxCats),
    props: db.get('props', null),
    zones: db.get('zones', []),
    rels: db.rels(),
    maxCats: cfg.maxCats,
  };
}

// ---------- chat pipeline ----------
const lastCmd = new Map();   // key -> ms
const today = () => new Date().toISOString().slice(0, 10);
const catKey = (platform, user, id) => `${platform}:${String(id || user || 'anon').toLowerCase()}`;
function onChat({ platform, user, id, msg, free }) {   // free = skip and don't consume the cooldown (paid redeems)
  msg = String(msg ?? '').trim(); user = String(user ?? 'anon').slice(0, 40) || 'anon';
  if (!msg.startsWith('!')) return;
  const key = catKey(platform, user, id);
  const now = Date.now();
  if (!free && platform !== 'admin') {
    if (now - (lastCmd.get(key) || 0) < cfg.cooldownMs) {
      broadcast({ type: 'cooldown', key }, 'overlay');   // the cat shows a little hourglass
      broadcast({ type: 'log', platform, user, msg: msg + ' (cooldown)' }, 'admin');
      return;
    }
    lastCmd.set(key, now);
  }
  if (lastCmd.size > 5000) for (const [k, t] of lastCmd) if (now - t > 60e3) lastCmd.delete(k);
  const prev = db.getCat(key), away = prev ? now - prev.last : 0;   // so the overlay can welcome regulars back
  db.touchCat(key);
  if (platform !== 'admin') { db.usage(today(), 'commands'); db.chatter(today(), key); }   // pilot metrics: is chat actually using it?
  if (platform !== 'admin') db.bump(key, 'cmds');
  broadcast({ type: 'chat', platform, user, key, msg, away, lvl: levelOf(key) }, 'overlay');
  broadcast({ type: 'log', platform, user, msg }, 'admin');
}
function fireEvent(name, by = 'admin', args = {}) {
  if (!EVENTS.includes(name)) return false;
  if (name === 'clearcats') db.clearCats();   // stage and memory
  db.usage(today(), 'events');
  broadcast({ type: 'event', name, ...args, ...(name === 'race' ? { predictions: canPredict() } : {}) }, 'overlay');
  broadcast({ type: 'log', platform: 'event', user: by, msg: name }, 'admin');
  return true;
}
// ---------- photos: saved to photos/, posted to Discord if DISCORD_WEBHOOK is set ----------
async function savePhoto(dataUrl, by) {
  const buf = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  const dir = path.join(ROOT, 'photos'); fs.mkdirSync(dir, { recursive: true });
  const name = `${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`; fs.writeFileSync(path.join(dir, name), buf);
  broadcast({ type: 'log', platform: 'photo', user: by, msg: `saved photos/${name}` }, 'admin');
  const hook = env('DISCORD_WEBHOOK'); if (!hook) return;
  try {
    const form = new FormData(); form.append('payload_json', JSON.stringify({ content: `📸 ${by} took a photo` })); form.append('files[0]', new Blob([buf], { type: 'image/jpeg' }), name);
    const r = await fetch(hook, { method: 'POST', body: form }); if (!r.ok) console.error('[photo] discord', r.status);
  } catch (e) { console.error('[photo] discord failed:', e.message); }
}
// ---------- twitch predictions (cat race) ----------
const canPredict = () => !!(twitch?.connected && cfg.predictions && (twitch.info?.scopes || []).includes('channel:manage:predictions'));
let prediction = null;   // {id, outcomes:{name -> outcome id}}
async function onRace(m) {
  broadcast({ type: 'log', platform: 'race', user: 'overlay', msg: m.phase + (m.name ? ': ' + m.name : '') }, 'admin');
  if (!canPredict()) return;
  try {
    if (m.phase === 'roster' && Array.isArray(m.racers) && m.racers.length >= 2) {
      const outcomes = m.racers.slice(0, 10).map(r => ({ title: String(r.name).slice(0, 25) }));
      const j = await twitch.helix('/predictions', { method: 'POST', body: JSON.stringify({ broadcaster_id: twitch.user.id, title: 'Cat race 🏁 who wins?', outcomes, prediction_window: 30 }) });
      const p = j.data?.[0]; if (!p) return;
      prediction = { id: p.id, outcomes: Object.fromEntries(p.outcomes.map(o => [o.title, o.id])) };
      console.log('[race] prediction opened', p.id);
    } else if (m.phase === 'winner' && prediction) {
      const win = prediction.outcomes[String(m.name).slice(0, 25)];
      await twitch.helix('/predictions', { method: 'PATCH', body: JSON.stringify({ broadcaster_id: twitch.user.id, id: prediction.id, status: win ? 'RESOLVED' : 'CANCELED', winning_outcome_id: win }) });
      console.log('[race] prediction', win ? 'resolved' : 'canceled'); prediction = null;
    } else if (m.phase === 'cancel' && prediction) {
      await twitch.helix('/predictions', { method: 'PATCH', body: JSON.stringify({ broadcaster_id: twitch.user.id, id: prediction.id, status: 'CANCELED' }) });
      prediction = null;
    }
  } catch (e) { console.error('[race] prediction failed:', e.message); prediction = null; }
}
// ---------- twitch eventsub ----------
// channel point redeems map reward title -> action: "!command" runs as the redeemer (user input appended), else an event name
function onTwitchEvent(ev) {
  ev.user = String(ev.user ?? 'someone').slice(0, 40); ev.id = String(ev.id ?? ev.user); ev.reward = String(ev.reward ?? ''); ev.input = String(ev.input ?? '').slice(0, 200);
  broadcast({ type: 'log', platform: 'twitch', user: ev.user, msg: describe(ev) }, 'admin');
  if (ev.kind === 'redeem') {
    const map = db.get('redeems', {}), action = map[ev.reward.toLowerCase()];
    if (!action) return;
    if (action.startsWith('!')) onChat({ platform: 'twitch', user: ev.user, id: ev.id, msg: (action + ' ' + ev.input).trim(), free: true });
    else fireEvent(action, ev.user);
    return;
  }
  broadcast({ type: 'twitch', ...ev, key: catKey('twitch', ev.user, ev.id) }, 'overlay');
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
  const authed = !KEY || url.searchParams.get('key') === KEY || req.headers['x-key'] === KEY;
  if (!authed && (p.startsWith('/api/') || p === '/admin' || p === '/admin/' || p === '/auth')) { res.writeHead(401, { 'content-type': 'text/plain' }); return res.end('add ?key=<ADMIN_KEY> to the URL'); }
  // API — GET is allowed too so Stream Deck's "Website" action can fire events
  if (p.startsWith('/api/')) {
    if (p === '/api/status') return json(res, 200, status);
    if (p === '/api/usage') return json(res, 200, db.usageReport(+url.searchParams.get('days') || 14));
    if (p === '/api/leaderboard') { const out = { cotd: catOfTheDay() }; for (const s of STATS) out[s] = db.top(s, +url.searchParams.get('n') || 5); return json(res, 200, out); }
    if (p === '/api/settings') {
      if (req.method === 'POST') { try { setSettings(JSON.parse(await readBody(req) || '{}')); } catch { return json(res, 400, { ok: false, error: 'bad json' }); } }
      return json(res, 200, { ...cfg, defaults: DEFAULTS });
    }
    const ev = p.match(/^\/api\/event\/([a-z]+)$/);
    if (ev) { const args = {}; for (const k of ['x', 'z', 'n']) if (url.searchParams.has(k)) args[k] = +url.searchParams.get(k); if (url.searchParams.has('kind')) args.kind = String(url.searchParams.get('kind')).slice(0, 10); return fireEvent(ev[1], 'admin', args) ? json(res, 200, { ok: true, event: ev[1] }) : json(res, 404, { ok: false, error: 'unknown event', events: EVENTS }); }
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
      return json(res, 200, { configured: true, connected: twitch.connected, user: twitch.info, eventsub: status.eventsub, rewards, redeems: db.get('redeems', {}), events: EVENTS, predictions: canPredict(), predictionScope: (twitch.info?.scopes || []).includes('channel:manage:predictions') });
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
  if (p === '/auth') { if (!twitch) return json(res, 400, { error: 'set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET in .env' }); oauthState = crypto.randomUUID(); res.writeHead(302, { location: twitch.authUrl(oauthState) }); return res.end(); }
  if (p === '/auth/callback') {   // twitch redirects here without our key, so the state nonce from /auth is the guard
    const code = url.searchParams.get('code');
    if (!code || !twitch || !oauthState || url.searchParams.get('state') !== oauthState) { res.writeHead(400); return res.end(`twitch auth failed: ${url.searchParams.get('error_description') || 'bad state or no code'}`); }
    oauthState = null;
    try { await twitch.exchange(code); startTwitch(); sendStatus(); res.writeHead(302, { location: '/admin' + (KEY ? `?key=${encodeURIComponent(KEY)}` : '') }); return res.end(); }
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
// what each role may send; nothing before a successful hello
const ALLOWED = { overlay: ['state', 'cat', 'catgone', 'props', 'zones', 'banner', 'race', 'stat', 'rel', 'photo', 'pos'], admin: ['chat', 'event'], play: ['poke'] };
const isStr = v => typeof v === 'string' && v.length > 0 && v.length < 200;
wss.on('connection', ws => {
  const c = { ws, role: null };   // role is set only once hello is accepted
  clients.add(c);
  ws.on('message', buf => {
    let m; try { m = JSON.parse(buf.toString()); } catch { return; }
    if (!m || typeof m !== 'object') return;
    try {
      if (m.type === 'hello') {
        if (c.role) return;
        const role = ['admin', 'play'].includes(m.role) ? m.role : 'overlay';
        if (KEY && role !== 'play' && m.key !== KEY) { ws.send(JSON.stringify({ type: 'denied' })); ws.close(); return; }
        if (role === 'play' && status.players >= MAX_PLAYERS) { ws.send(JSON.stringify({ type: 'full' })); ws.close(); return; }
        c.role = role;
        if (role === 'overlay') { status.overlays++; primary ??= c; ws.send(JSON.stringify(initPayload())); sendStatus(); sendWatchers(); }
        else if (role === 'play') { status.players++; ws.send(JSON.stringify(initPayload())); sendStatus(); sendWatchers(); }
        else ws.send(JSON.stringify({ type: 'status', ...status }));
        return;
      }
      if (!c.role || !ALLOWED[c.role].includes(m.type)) return;
      switch (m.type) {
        case 'state': if (c === primary && status.players && Array.isArray(m.cats)) broadcast({ type: 'state', cats: m.cats, t: Date.now() }, 'play'); break;
        case 'poke': {   // companion click; 1/s per viewer
          const now = Date.now(); if (now - (c.lastPoke || 0) < 1000) break; c.lastPoke = now;
          if (Number.isFinite(+m.x) && Number.isFinite(+m.z)) broadcast({ type: 'poke', x: +m.x, z: +m.z }, 'overlay');
          break; }
        case 'cat': if (isStr(m.key) && m.look && typeof m.look === 'object') db.saveCat(m.key, isStr(m.name) ? m.name : m.key, m.look); break;
        case 'catgone': if (isStr(m.key)) db.deleteCat(m.key); break;
        case 'props': if (Array.isArray(m.props)) db.set('props', m.props.slice(0, 50)); break;
        case 'zones': if (Array.isArray(m.zones)) db.set('zones', m.zones.slice(0, 20)); break;
        case 'chat': onChat({ platform: 'admin', user: isStr(m.user) ? m.user : 'streamer', msg: m.msg }); break;   // from admin page
        case 'event': if (isStr(m.name)) fireEvent(m.name); break;
        case 'banner': if (c === primary) broadcast({ type: 'banner', text: String(m.text ?? '').slice(0, 80), ms: +m.ms || 0 }, 'play'); break;
        case 'race': if (c === primary) onRace(m); break;
        case 'pos': if (c === primary && Array.isArray(m.cats)) for (const [k, x, z] of m.cats.slice(0, 200)) if (isStr(k) && Number.isFinite(+x) && Number.isFinite(+z)) db.setPos(k, +x, +z); break;
        case 'rel': if (c === primary && isStr(m.a) && isStr(m.b) && Number.isFinite(+m.d)) db.setRel([m.a, m.b].sort().join('|'), Math.max(-0.9, Math.min(0.9, +m.d))); break;
        case 'photo': if (c === primary && typeof m.data === 'string' && m.data.startsWith('data:image/jpeg;base64,') && m.data.length < 3e6) savePhoto(m.data, String(m.by || 'streamer').slice(0, 30)); break;
        case 'stat': if (c === primary && isStr(m.key) && STATS.includes(m.name)) db.bump(m.key, m.name); break;
      }
    } catch (e) { console.error('[ws]', c.role, m.type, e.message); }
  });
  ws.on('close', () => {
    clients.delete(c);
    if (c.role === 'overlay') { status.overlays = Math.max(0, status.overlays - 1); if (primary === c) primary = [...clients].find(x => x.role === 'overlay') || null; }
    if (c.role === 'play') status.players = Math.max(0, status.players - 1);
    if (c.role) { sendStatus(); sendWatchers(); }
  });
});

// ---------- chat sources ----------
const twitchCh = env('TWITCH_CHANNEL'), kickCh = env('KICK_CHANNEL');
if (twitchCh) connectTwitch(twitchCh.replace(/^#/, ''), onChat, ok => { status.twitch = ok; sendStatus(); });
if (kickCh) connectKick(kickCh, env('KICK_CHATROOM_ID'), onChat, ok => { status.kick = ok; sendStatus(); });
if (!twitchCh && !kickCh) console.log('no TWITCH_CHANNEL / KICK_CHANNEL in .env — running with admin/simulated chat only');

setInterval(() => { if (status.overlays > 0) db.usage(today(), 'minutes'); }, 60000);   // overlay-online minutes per day
server.listen(PORT, () => {
  console.log(`chat-cats  overlay: http://localhost:${PORT}/?ui=0&bg=0   admin: http://localhost:${PORT}/admin`);
});
