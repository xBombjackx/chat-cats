// Twitch OAuth (authorization code flow) + a tiny Helix client. Token lives in SQLite and auto-refreshes.
// Needs a Twitch app (dev.twitch.tv/console) with redirect URL http://localhost:<PORT>/auth/callback.
export const SCOPES = ['channel:read:redemptions', 'channel:read:subscriptions', 'bits:read', 'moderator:read:followers'];

export function makeTwitchAuth({ clientId, clientSecret, redirectUri, db, idUrl = 'https://id.twitch.tv/oauth2', apiUrl = 'https://api.twitch.tv/helix' }) {
  let tok = db.get('twitch_token', null);   // {access, refresh, expires, user:{id,login,name}, scopes}
  const save = () => db.set('twitch_token', tok);

  async function tokenRequest(params) {
    const r = await fetch(`${idUrl}/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params }) });
    const j = await r.json();
    if (!r.ok) throw new Error(`token: ${j.message || r.status}`);
    return j;
  }
  async function store(j) {
    tok = { access: j.access_token, refresh: j.refresh_token, expires: Date.now() + j.expires_in * 1000, scopes: j.scope || [], user: tok?.user };
    const u = (await helix('/users')).data?.[0];
    if (u) tok.user = { id: u.id, login: u.login, name: u.display_name };
    save();
    return tok;
  }
  async function refresh() {
    if (!tok?.refresh) throw new Error('no refresh token');
    return store(await tokenRequest({ grant_type: 'refresh_token', refresh_token: tok.refresh }));
  }
  async function token() {
    if (!tok) return null;
    if (Date.now() > tok.expires - 120e3) await refresh();
    return tok.access;
  }
  async function helix(path, init = {}, retry = true) {
    const t = await token(); if (!t) throw new Error('not connected to twitch');
    const r = await fetch(apiUrl + path, { ...init, headers: { 'client-id': clientId, authorization: `Bearer ${t}`, 'content-type': 'application/json', ...(init.headers || {}) } });
    if (r.status === 401 && retry) { await refresh(); return helix(path, init, false); }
    if (r.status === 204) return {};
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`helix ${path}: ${r.status} ${j.message || ''}`);
    return j;
  }

  return {
    authUrl(state) {
      return `${idUrl}/authorize?` + new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: redirectUri, scope: SCOPES.join(' '), state });
    },
    async exchange(code) { return store(await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri })); },
    token, helix,
    get user() { return tok?.user || null; },
    get connected() { return !!tok; },
    get info() { return tok ? { login: tok.user?.login, name: tok.user?.name, id: tok.user?.id, scopes: tok.scopes, expires: tok.expires } : null; },
    disconnect() { tok = null; db.set('twitch_token', null); },
  };
}
