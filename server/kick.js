// Kick chat via their public Pusher websocket. Needs the channel's chatroom id; we try to look it up from
// kick.com's API (sometimes Cloudflare-blocked) and fall back to KICK_CHATROOM_ID from .env.
import WebSocket from 'ws';

const PUSHER = 'wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0&flash=false';

async function lookupChatroom(slug) {
  const r = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`, {
    headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 chat-cats' },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  if (!j?.chatroom?.id) throw new Error('no chatroom id in response');
  return j.chatroom.id;
}

export function connectKick(slug, chatroomId, onMessage, onStatus) {
  let ws, stopped = false, backoff = 2000;

  async function open() {
    if (stopped) return;
    let id = chatroomId;
    if (!id) {
      try { id = await lookupChatroom(slug); console.log(`[kick] chatroom id for ${slug}: ${id}`); }
      catch (e) { console.error(`[kick] lookup failed (${e.message}). Set KICK_CHATROOM_ID in .env. Retrying in 60s.`); return setTimeout(open, 60000); }
      chatroomId = id;
    }
    ws = new WebSocket(PUSHER);
    ws.on('open', () => {
      ws.send(JSON.stringify({ event: 'pusher:subscribe', data: { auth: '', channel: `chatrooms.${id}.v2` } }));
      console.log(`[kick] joined ${slug} (chatroom ${id})`); onStatus(true); backoff = 2000;
    });
    ws.on('message', buf => {
      let m; try { m = JSON.parse(buf.toString()); } catch { return; }
      if (m.event !== 'App\\Events\\ChatMessageEvent') return;
      let d; try { d = JSON.parse(m.data); } catch { return; }
      const user = d?.sender?.username; if (!user || !d.content) return;
      onMessage({ platform: 'kick', user, id: user.toLowerCase(), msg: d.content });
    });
    ws.on('close', () => { onStatus(false); if (!stopped) { console.log(`[kick] closed, reconnecting in ${backoff / 1000}s`); setTimeout(open, backoff); backoff = Math.min(backoff * 2, 60000); } });
    ws.on('error', e => console.error('[kick] ws error:', e.message));
  }
  open();
  return () => { stopped = true; ws?.close(); };
}
