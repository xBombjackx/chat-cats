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
  let ws, stopped = false, backoff = 2000, watchdog, subscribed = false;
  const reset = () => { stopped = true; clearTimeout(watchdog); ws?.close(); };

  function connect(url, isReconnect) {
    const sock = new WebSocket(url);
    sock.on('open', () => log(`[eventsub] connected${isReconnect ? ' (reconnect)' : ''}`));
    sock.on('message', async buf => {
      let m; try { m = JSON.parse(buf.toString()); } catch { return; }
      const t = m.metadata?.message_type;
      const timeout = (m.payload?.session?.keepalive_timeout_seconds || 10) * 1000 + 5000;
      clearTimeout(watchdog); watchdog = setTimeout(() => { log('[eventsub] keepalive missed, reconnecting'); sock.terminate(); }, timeout);
      if (t === 'session_welcome') {
        if (ws && ws !== sock) ws.close();   // old socket after a session_reconnect
        ws = sock; backoff = 2000;
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
      clearTimeout(watchdog);
      if (sock !== ws && ws) return;   // superseded by a reconnect socket
      onStatus(false); subscribed = false;
      if (!stopped) { log(`[eventsub] closed, retry in ${backoff / 1000}s`); setTimeout(() => connect(wsUrl), backoff); backoff = Math.min(backoff * 2, 60000); }
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
