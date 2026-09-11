// SQLite via node:sqlite (built into Node 22.13+, no native build step)
import { DatabaseSync } from 'node:sqlite';

export function openDb(path) {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;
    CREATE TABLE IF NOT EXISTS cats (
      key TEXT PRIMARY KEY,          -- platform:username (lowercase)
      name TEXT NOT NULL,            -- display name
      look TEXT NOT NULL,            -- JSON {body,eyes,pattern,hat}
      last INTEGER NOT NULL          -- ms epoch of last activity
    );
    CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS stats (key TEXT NOT NULL, stat TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(key, stat));
    CREATE TABLE IF NOT EXISTS usage (day TEXT PRIMARY KEY, commands INTEGER NOT NULL DEFAULT 0, minutes INTEGER NOT NULL DEFAULT 0, events INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS chatters (day TEXT NOT NULL, key TEXT NOT NULL, PRIMARY KEY(day, key));
    CREATE TABLE IF NOT EXISTS rels (pair TEXT PRIMARY KEY, d REAL NOT NULL);
  `);
  const upsertCat = db.prepare(`INSERT INTO cats(key,name,look,last) VALUES(?,?,?,?)
    ON CONFLICT(key) DO UPDATE SET name=excluded.name, look=excluded.look, last=excluded.last`);
  const touchCat = db.prepare(`UPDATE cats SET last=? WHERE key=?`);
  const delCat = db.prepare(`DELETE FROM cats WHERE key=?`);
  const getCat = db.prepare(`SELECT key,name,look,last FROM cats WHERE key=?`);
  const recentCats = db.prepare(`SELECT key,name,look,last FROM cats WHERE last>? ORDER BY last DESC LIMIT ?`);
  const getKv = db.prepare(`SELECT v FROM kv WHERE k=?`);
  const bump = db.prepare(`INSERT INTO stats(key,stat,n) VALUES(?,?,1) ON CONFLICT(key,stat) DO UPDATE SET n=n+1`);
  const top = db.prepare(`SELECT s.key, c.name, s.n FROM stats s LEFT JOIN cats c ON c.key=s.key WHERE s.stat=? ORDER BY s.n DESC LIMIT ?`);
  const anyCats = db.prepare(`SELECT key,name FROM cats WHERE last>? ORDER BY RANDOM() LIMIT 1`);
  const setKv = db.prepare(`INSERT INTO kv(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`);

  return {
    saveCat(key, name, look) { upsertCat.run(key, name, JSON.stringify(look), Date.now()); },
    touchCat(key) { touchCat.run(Date.now(), key); },
    deleteCat(key) { delCat.run(key); },
    clearCats() { db.exec('DELETE FROM cats'); },
    getCat(key) { const r = getCat.get(key); return r ? { ...r, look: JSON.parse(r.look) } : null; },
    recentCats(maxAgeMs, limit) {
      return recentCats.all(Date.now() - maxAgeMs, limit).map(r => ({ ...r, look: JSON.parse(r.look) }));
    },
    get(k, fallback) { const r = getKv.get(k); return r ? JSON.parse(r.v) : fallback; },
    set(k, v) { setKv.run(k, JSON.stringify(v)); },
    bump(key, stat) { bump.run(key, stat); },
    top(stat, limit = 5) { return top.all(stat, limit).map(r => ({ key: r.key, name: r.name || r.key.split(':')[1], n: r.n })); },
    randomCat(maxAgeMs) { return anyCats.get(Date.now() - maxAgeMs) || null; },
    setRel(pair, dv) { db.prepare('INSERT INTO rels(pair,d) VALUES(?,?) ON CONFLICT(pair) DO UPDATE SET d=excluded.d').run(pair, dv); },
    rels() { return Object.fromEntries(db.prepare('SELECT pair,d FROM rels').all().map(r => [r.pair, r.d])); },
    statOf(key, stat) { const r = db.prepare('SELECT n FROM stats WHERE key=? AND stat=?').get(key, stat); return r ? r.n : 0; },
    usage(day, col) { db.prepare(`INSERT INTO usage(day,${col}) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET ${col}=${col}+1`).run(day); },
    chatter(day, key) { db.prepare('INSERT OR IGNORE INTO chatters(day,key) VALUES(?,?)').run(day, key); },
    usageReport(days) { return db.prepare(`SELECT u.day, u.commands, u.minutes, u.events, (SELECT COUNT(*) FROM chatters c WHERE c.day=u.day) AS chatters FROM usage u ORDER BY u.day DESC LIMIT ?`).all(days); },
  };
}
