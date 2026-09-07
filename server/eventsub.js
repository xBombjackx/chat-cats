// Twitch EventSub over websocket: follows, subs, gifts, cheers, raids, channel point redemptions.
// Normalizes everything to {kind, user, id, ...} for the overlay.
import WebSocket from 'ws';

const SUBS = uid => [
  { type: 'channel.follow', version: '2', condition: { broadcaster_user_id: uid, moderator_user_id: uid } },
  { type: 'channel.subscribe', version: '1', condition: { broadcaster_user_id: uid } },
  { type: 'channel.subscription.message', version: '1', condition: { broadcaster_user_id: uid } },
  { type: 'channel.subscription.gift', version: '1', condition: { broadcaster_user_id: uid } },
  { type: 'channel.cheer', version: '1', condition: { broadcaster_user_id: uid } },
  { type: 'channel.raid', version: '1', condition: { to_broadcaster_user_id: uid } },
  { type: 'channel.channel_points_custom_reward_redemption.add', version: '1', condition: { broadcaster_user_id: uid } },
];

export function normalize(type, e) {
  const user = e.user_name || e.from_broadcaster_user_name || 'someone', id = e.user_login || e.from_broadcaster_user_login || user;
  switch (type) {
    case 'channel.follow': return { kind: 'follow', user, id };
    case 'channel.subscribe': return e.is_gift ? null : { kind: 'sub', user, id, tier: e.tier };            // gifted subs arrive via subscription.gift
    case 'channel.subscription.message': return { kind: 'resub', user, id, months: e.cumulative_months, tier: e.tier, text: e.message?.text || '' };
    case 'channel.subscription.gift': return { kind: 'gift', user: e.is_anonymous ? 'anonymous' : user, id: e.is_anonymous ? 'anonymous' : id, count: e.total || 1, tier: e.tier };
    case 'channel.cheer': return { kind: 'cheer', user: e.is_anonymous ? 'anonymous' : user, id: e.is_anonymous ? 'anonymous' : id, bits: e.bits, text: e.message || '' };
    case 'channel.raid': return { kind: 'raid', user, id, viewers: e.viewers };
    case 'channel.channel_points_custom_reward_redemption.add': return { kind: 'redeem', user, id, reward: e.reward?.title || '', input: e.user_input || '', cost: e.reward?.cost };
  }
  return null;
}

export function startEventSub({ wsUrl = 'wss://eventsub.wss.twitch.tv/ws', helix, userId, onEvent, onStatus, log = console.log }) {
  let ws = null, pending = null, retryTimer = null, stopped = false, backoff = 2000, subscribed = false;
  // ws = live session socket, pending = socket still waiting for its welcome
  const reset = () => { stopped = true; clearTimeout(retryTimer); for (const s of [ws, pending]) { if (s) { clearTimeout(s.watchdog); s.terminate(); } } ws = pending = null; };
  const scheduleRetry = () => { if (stopped || retryTimer) return; log(`[eventsub] retry in ${backoff / 1000}s`); retryTimer = setTimeout(() => { retryTimer = null; connect(wsUrl); }, backoff); backoff = Math.min(backoff * 2, 60000); };

  function connect(url, isReconnect) {
    if (stopped) return;
    const sock = new WebSocket(url);
    pending = sock;
    sock.on('open', () => log(`[eventsub] connected${isReconnect ? ' (reconnect)' : ''}`));
    sock.on('message', async buf => {
      let m; try { m = JSON.parse(buf.toString()); } catch { return; }
      const t = m.metadata?.message_type;
      const timeout = (m.payload?.session?.keepalive_timeout_seconds || 10) * 1000 + 5000;
      clearTimeout(sock.watchdog); sock.watchdog = setTimeout(() => { log('[eventsub] keepalive missed, reconnecting'); sock.terminate(); }, timeout);
      if (t === 'session_welcome') {
        if (stopped) { sock.terminate(); return; }
        if (ws && ws !== sock) { const old = ws; ws = null; clearTimeout(old.watchdog); old.close(); }   // old socket after a session_reconnect
        ws = sock; if (pending === sock) pending = null; backoff = 2000;
        if (!isReconnect || !subscribed) await subscribeAll(m.payload.session.id);
        onStatus(true);
      } else if (t === 'session_reconnect') {
        log('[eventsub] twitch asked us to reconnect');
        connect(m.payload.session.reconnect_url, true);
      } else if (t === 'notification') {
        const ev = normalize(m.payload.subscription.type, m.payload.event);
        if (ev) onEvent(ev);
      } else if (t === 'revocation') {
        log(`[eventsub] revoked: ${m.payload.subscription.type} (${m.payload.subscription.status})`);
      }
    });
    sock.on('close', () => {
      clearTimeout(sock.watchdog);
      if (pending === sock) pending = null;
      if (sock !== ws) { if (!ws && !stopped) scheduleRetry(); return; }   // a superseded or failed-before-welcome socket; retry only if nothing is live
      ws = null; onStatus(false); subscribed = false;
      if (!stopped) { log('[eventsub] session closed'); scheduleRetry(); }
    });
    sock.on('error', e => log('[eventsub] error:', e.message));
  }

  async function subscribeAll(sessionId) {
    let ok = 0;
    for (const s of SUBS(userId)) {
      try { await helix('/eventsub/subscriptions', { method: 'POST', body: JSON.stringify({ ...s, transport: { method: 'websocket', session_id: sessionId } }) }); ok++; }
      catch (e) { log(`[eventsub] ${s.type}: ${e.message}`); }
    }
    subscribed = ok > 0;
    log(`[eventsub] ${ok}/${SUBS(userId).length} subscriptions active`);
  }

  connect(wsUrl);
  return reset;
}
